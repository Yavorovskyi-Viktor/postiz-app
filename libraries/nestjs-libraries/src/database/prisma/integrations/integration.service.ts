import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { IntegrationRepository } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.repository';
import { IntegrationManager } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { InstagramProvider } from '@gitroom/nestjs-libraries/integrations/social/instagram.provider';
import { FacebookProvider } from '@gitroom/nestjs-libraries/integrations/social/facebook.provider';
import {
  AnalyticsData,
  SocialProvider,
} from '@gitroom/nestjs-libraries/integrations/social/social.integrations.interface';
import { Integration, Organization } from '@prisma/client';
import { NotificationService } from '@gitroom/nestjs-libraries/database/prisma/notifications/notification.service';
import { LinkedinPageProvider } from '@gitroom/nestjs-libraries/integrations/social/linkedin.page.provider';
import dayjs from 'dayjs';
import { timer } from '@gitroom/helpers/utils/timer';
import { ioRedis } from '@gitroom/nestjs-libraries/redis/redis.service';
import { RefreshToken } from '@gitroom/nestjs-libraries/integrations/social.abstract';
import { IntegrationTimeDto } from '@gitroom/nestjs-libraries/dtos/integrations/integration.time.dto';
import { UploadFactory } from '@gitroom/nestjs-libraries/upload/upload.factory';
import { PlugDto } from '@gitroom/nestjs-libraries/dtos/plugs/plug.dto';
import { BullMqClient } from '@gitroom/nestjs-libraries/bull-mq-transport-new/client';
import { difference } from 'lodash';

@Injectable()
export class IntegrationService {
  private storage = UploadFactory.createStorage();
  constructor(
    private _integrationRepository: IntegrationRepository,
    private _integrationManager: IntegrationManager,
    private _notificationService: NotificationService,
    private _workerServiceProducer: BullMqClient
  ) {}

  async setTimes(
    orgId: string,
    integrationId: string,
    times: IntegrationTimeDto
  ) {
    return this._integrationRepository.setTimes(orgId, integrationId, times);
  }

  async createOrUpdateIntegration(
    org: string,
    name: string,
    picture: string,
    type: 'article' | 'social',
    internalId: string,
    provider: string,
    token: string,
    refreshToken = '',
    expiresIn?: number,
    username?: string,
    isBetweenSteps = false,
    refresh?: string,
    timezone?: number,
    customInstanceDetails?: string
  ) {
    const uploadedPicture = await this.storage.uploadSimple(picture);
    return this._integrationRepository.createOrUpdateIntegration(
      org,
      name,
      uploadedPicture,
      type,
      internalId,
      provider,
      token,
      refreshToken,
      expiresIn,
      username,
      isBetweenSteps,
      refresh,
      timezone,
      customInstanceDetails
    );
  }

  getIntegrationsList(org: string) {
    return this._integrationRepository.getIntegrationsList(org);
  }

  getIntegrationForOrder(id: string, order: string, user: string, org: string) {
    return this._integrationRepository.getIntegrationForOrder(
      id,
      order,
      user,
      org
    );
  }

  updateNameAndUrl(id: string, name: string, url: string) {
    return this._integrationRepository.updateNameAndUrl(id, name, url);
  }

  getIntegrationById(org: string, id: string) {
    return this._integrationRepository.getIntegrationById(org, id);
  }

  async refreshToken(provider: SocialProvider, refresh: string) {
    try {
      const { refreshToken, accessToken, expiresIn } =
        await provider.refreshToken(refresh);

      if (!refreshToken || !accessToken || !expiresIn) {
        return false;
      }

      return { refreshToken, accessToken, expiresIn };
    } catch (e) {
      return false;
    }
  }

  async disconnectChannel(orgId: string, integration: Integration) {
    await this._integrationRepository.disconnectChannel(orgId, integration.id);
    await this.informAboutRefreshError(orgId, integration);
  }

  async informAboutRefreshError(orgId: string, integration: Integration) {
    await this._notificationService.inAppNotification(
      orgId,
      `Could not refresh your ${integration.providerIdentifier} channel`,
      `Could not refresh your ${integration.providerIdentifier} channel. Please go back to the system and connect it again ${process.env.FRONTEND_URL}/launches`,
      true
    );
  }

  async refreshNeeded(org: string, id: string) {
    return this._integrationRepository.refreshNeeded(org, id);
  }

  async refreshTokens() {
    const integrations = await this._integrationRepository.needsToBeRefreshed();
    for (const integration of integrations) {
      const provider = this._integrationManager.getSocialIntegration(
        integration.providerIdentifier
      );

      const data = await this.refreshToken(provider, integration.refreshToken!);

      if (!data) {
        await this.informAboutRefreshError(
          integration.organizationId,
          integration
        );
        await this._integrationRepository.refreshNeeded(
          integration.organizationId,
          integration.id
        );
        return;
      }

      const { refreshToken, accessToken, expiresIn } = data;

      await this.createOrUpdateIntegration(
        integration.organizationId,
        integration.name,
        integration.picture!,
        'social',
        integration.internalId,
        integration.providerIdentifier,
        accessToken,
        refreshToken,
        expiresIn
      );
    }
  }

  async disableChannel(org: string, id: string) {
    return this._integrationRepository.disableChannel(org, id);
  }

  async enableChannel(org: string, totalChannels: number, id: string) {
    const integrations = (
      await this._integrationRepository.getIntegrationsList(org)
    ).filter((f) => !f.disabled);
    if (integrations.length >= totalChannels) {
      throw new Error('You have reached the maximum number of channels');
    }

    return this._integrationRepository.enableChannel(org, id);
  }

  async getPostsForChannel(org: string, id: string) {
    return this._integrationRepository.getPostsForChannel(org, id);
  }

  async deleteChannel(org: string, id: string) {
    return this._integrationRepository.deleteChannel(org, id);
  }

  async disableIntegrations(org: string, totalChannels: number) {
    return this._integrationRepository.disableIntegrations(org, totalChannels);
  }

  async checkForDeletedOnceAndUpdate(org: string, page: string) {
    return this._integrationRepository.checkForDeletedOnceAndUpdate(org, page);
  }

  async saveInstagram(
    org: string,
    id: string,
    data: { pageId: string; id: string }
  ) {
    const getIntegration = await this._integrationRepository.getIntegrationById(
      org,
      id
    );
    if (getIntegration && !getIntegration.inBetweenSteps) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }

    const instagram = this._integrationManager.getSocialIntegration(
      'instagram'
    ) as InstagramProvider;
    const getIntegrationInformation = await instagram.fetchPageInformation(
      getIntegration?.token!,
      data
    );

    await this.checkForDeletedOnceAndUpdate(org, getIntegrationInformation.id);
    await this._integrationRepository.updateIntegration(id, {
      picture: getIntegrationInformation.picture,
      internalId: getIntegrationInformation.id,
      name: getIntegrationInformation.name,
      inBetweenSteps: false,
      token: getIntegrationInformation.access_token,
      profile: getIntegrationInformation.username,
    });

    return { success: true };
  }

  async saveLinkedin(org: string, id: string, page: string) {
    const getIntegration = await this._integrationRepository.getIntegrationById(
      org,
      id
    );
    if (getIntegration && !getIntegration.inBetweenSteps) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }

    const linkedin = this._integrationManager.getSocialIntegration(
      'linkedin-page'
    ) as LinkedinPageProvider;

    const getIntegrationInformation = await linkedin.fetchPageInformation(
      getIntegration?.token!,
      page
    );

    await this.checkForDeletedOnceAndUpdate(
      org,
      String(getIntegrationInformation.id)
    );

    await this._integrationRepository.updateIntegration(String(id), {
      picture: getIntegrationInformation.picture,
      internalId: String(getIntegrationInformation.id),
      name: getIntegrationInformation.name,
      inBetweenSteps: false,
      token: getIntegrationInformation.access_token,
      profile: getIntegrationInformation.username,
    });

    return { success: true };
  }

  async saveFacebook(org: string, id: string, page: string) {
    const getIntegration = await this._integrationRepository.getIntegrationById(
      org,
      id
    );
    if (getIntegration && !getIntegration.inBetweenSteps) {
      throw new HttpException('Invalid request', HttpStatus.BAD_REQUEST);
    }

    const facebook = this._integrationManager.getSocialIntegration(
      'facebook'
    ) as FacebookProvider;
    const getIntegrationInformation = await facebook.fetchPageInformation(
      getIntegration?.token!,
      page
    );

    await this.checkForDeletedOnceAndUpdate(org, getIntegrationInformation.id);
    await this._integrationRepository.updateIntegration(id, {
      picture: getIntegrationInformation.picture,
      internalId: getIntegrationInformation.id,
      name: getIntegrationInformation.name,
      inBetweenSteps: false,
      token: getIntegrationInformation.access_token,
      profile: getIntegrationInformation.username,
    });

    return { success: true };
  }

  async checkAnalytics(
    org: Organization,
    integration: string,
    date: string,
    forceRefresh = false
  ): Promise<AnalyticsData[]> {
    const getIntegration = await this.getIntegrationById(org.id, integration);

    if (!getIntegration) {
      throw new Error('Invalid integration');
    }

    if (getIntegration.type !== 'social') {
      return [];
    }

    const integrationProvider = this._integrationManager.getSocialIntegration(
      getIntegration.providerIdentifier
    );

    if (
      dayjs(getIntegration?.tokenExpiration).isBefore(dayjs()) ||
      forceRefresh
    ) {
      const { accessToken, expiresIn, refreshToken } =
        await integrationProvider.refreshToken(getIntegration.refreshToken!);

      if (accessToken) {
        await this.createOrUpdateIntegration(
          getIntegration.organizationId,
          getIntegration.name,
          getIntegration.picture!,
          'social',
          getIntegration.internalId,
          getIntegration.providerIdentifier,
          accessToken,
          refreshToken,
          expiresIn
        );

        getIntegration.token = accessToken;

        if (integrationProvider.refreshWait) {
          await timer(10000);
        }
      } else {
        await this.disconnectChannel(org.id, getIntegration);
        return [];
      }
    }

    const getIntegrationData = await ioRedis.get(
      `integration:${org.id}:${integration}:${date}`
    );
    if (getIntegrationData) {
      return JSON.parse(getIntegrationData);
    }

    if (integrationProvider.analytics) {
      try {
        const loadAnalytics = await integrationProvider.analytics(
          getIntegration.internalId,
          getIntegration.token,
          +date
        );
        await ioRedis.set(
          `integration:${org.id}:${integration}:${date}`,
          JSON.stringify(loadAnalytics),
          'EX',
          !process.env.NODE_ENV || process.env.NODE_ENV === 'development'
            ? 1
            : 3600
        );
        return loadAnalytics;
      } catch (e) {
        if (e instanceof RefreshToken) {
          return this.checkAnalytics(org, integration, date);
        }
      }
    }

    return [];
  }

  getPlugsByIntegrationId(org: string, integrationId: string) {
    return this._integrationRepository.getPlugsByIntegrationId(
      org,
      integrationId
    );
  }

  processPlugs(
    orgId: string,
    integrationId: string,
    delay: number,
    funcName: string
  ) {
    return this._workerServiceProducer.emit('plugs', {
      id: integrationId + '-' + funcName,
      options: {
        delay: 0, // delay,
      },
      payload: {
        retry: 1,
        delay,
        orgId,
        integrationId: integrationId,
        funcName: funcName,
      },
    });
  }

  async activatedPlug(
    orgId: string,
    integrationId: string,
    funcName: string,
    type: 'add' | 'remove'
  ) {
    const loadIntegration = await this.getIntegrationById(orgId, integrationId);
    const allPlugs = this._integrationManager.getAllPlugs();
    const findPlug = allPlugs.find(
      (p) => p.identifier === loadIntegration?.providerIdentifier!
    )!;
    const plug = findPlug.plugs.find((p: any) => p.methodName === funcName)!;

    if (type === 'add') {
      return this.processPlugs(
        orgId,
        integrationId,
        plug.runEveryMilliseconds,
        funcName
      );
    } else {
      console.log(integrationId + '-' + funcName);
      return this._workerServiceProducer.delete(
        'plugs',
        integrationId + '-' + funcName
      );
    }
  }

  async createOrUpdatePlug(
    orgId: string,
    integrationId: string,
    body: PlugDto
  ) {
    const { activated } = await this._integrationRepository.createOrUpdatePlug(
      orgId,
      integrationId,
      body
    );

    if (activated) {
      await this.activatedPlug(orgId, integrationId, body.func, 'add');
    }
  }

  async changePlugActivation(orgId: string, plugId: string, status: boolean) {
    const { id, integrationId, plugFunction } =
      await this._integrationRepository.changePlugActivation(
        orgId,
        plugId,
        status
      );

    if (status) {
      await this.activatedPlug(orgId, integrationId, plugFunction, 'add');
    } else {
      await this.activatedPlug(orgId, integrationId, plugFunction, 'remove');
    }

    return { id };
  }

  async loadExisingData (methodName: string, integrationId: string, id: string[]) {
    const exisingData = await this._integrationRepository.loadExisingData(methodName, integrationId, id);
    const loadOnlyIds = exisingData.map(p => p.value);
    return difference(id, loadOnlyIds);
  }

  async startPlug(data: {
    orgId: string;
    integrationId: string;
    funcName: string;
    retry: number;
    delay: number;
  }) {
    const integration = await this.getIntegrationById(
      data.orgId,
      data.integrationId
    );

    if (!integration) {
      return;
    }

    const plugInformation = (
      await this._integrationRepository.getPlugsByIntegrationId(
        data.orgId,
        data.integrationId
      )
    ).find((p) => p.plugFunction === data.funcName)!;

    const plugData = JSON.parse(plugInformation.data).reduce(
      (all: any, current: any) => ({
        ...all,
        [current.name]: current.value,
      }),
      {}
    );

    const integrationInstance = this._integrationManager.getSocialIntegration(
      integration.providerIdentifier
    );

    // @ts-ignore
    const ids = await integrationInstance[data.funcName](integration, plugData, this.loadExisingData.bind(this));
    return this._integrationRepository.saveExisingData(data.funcName, data.integrationId, ids);
  }
}
