'use client';

import useSWR from 'swr';
import { useCallback, useMemo, useState } from 'react';
import { capitalize, orderBy } from 'lodash';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import Image from 'next/image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { RenderAnalytics } from '@gitroom/frontend/components/platform-analytics/render.analytics';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import { useRouter } from 'next/navigation';

const allowedIntegrations = [
  'facebook',
  'instagram',
  'linkedin-page',
  'tiktok',
  'youtube',
  'pinterest',
];

export const PlatformAnalytics = () => {
  const fetch = useFetch();
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [key, setKey] = useState(7);

  const load = useCallback(async () => {
    const int = (await (await fetch('/integrations/list')).json()).integrations;
    return int.filter((f: any) => allowedIntegrations.includes(f.identifier));
  }, []);

  const { data, isLoading } = useSWR('analytics-list', load, {
    fallbackData: [],
  });

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data,
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);

  const currentIntegration = useMemo(() => {
    return sortedIntegrations[current];
  }, [current, sortedIntegrations]);

  const options = useMemo(() => {
    if (!currentIntegration) {
      return [];
    }
    const arr = [];
    if (
      [
        'facebook',
        'instagram',
        'linkedin-page',
        'pinterest',
        'youtube',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 7,
        value: '7 Days',
      });
    }

    if (
      [
        'facebook',
        'instagram',
        'linkedin-page',
        'pinterest',
        'youtube',
      ].indexOf(currentIntegration.identifier) !== -1
    ) {
      arr.push({
        key: 30,
        value: '30 Days',
      });
    }

    if (
      ['facebook', 'linkedin-page', 'pinterest', 'youtube'].indexOf(
        currentIntegration.identifier
      ) !== -1
    ) {
      arr.push({
        key: 90,
        value: '90 Days',
      });
    }

    return arr;
  }, [currentIntegration]);

  const keys = useMemo(() => {
    if (!currentIntegration) {
      return 7;
    }
    if (options.find((p) => p.key === key)) {
      return key;
    }

    return options[0]?.key;
  }, [key, currentIntegration]);

  if (isLoading) {
    return null;
  }

  if (!sortedIntegrations.length && !isLoading) {
    return (
      <div className="flex flex-col items-center mt-[100px] gap-[27px] text-center">
        <div>
          <img src="/peoplemarketplace.svg" />
        </div>
        <div className="text-[48px]">
          Can{"'"}t show analytics yet
          <br />
          You have to add Social Media channels
        </div>
        <div className="text-[20px]">
          Supported: {allowedIntegrations.map(p => capitalize(p)).join(', ')}
        </div>
        <Button onClick={() => router.push('/launches')}>
          Go to the calendar to add channels
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-[30px] flex-1">
      <div className="p-[16px] bg-[#080B14] overflow-hidden flex w-[220px]">
        <div className="flex gap-[16px] flex-col overflow-hidden">
          <div className="text-[20px] mb-[8px]">Channels</div>
          {sortedIntegrations.map((integration, index) => (
            <div
              key={integration.id}
              onClick={() => setCurrent(index)}
              className={clsx(
                'flex gap-[8px] items-center',
                currentIntegration.id !== integration.id &&
                  'opacity-20 hover:opacity-100 cursor-pointer'
              )}
            >
              <div
                className={clsx(
                  'relative w-[34px] h-[34px] rounded-full flex justify-center items-center bg-fifth',
                  integration.disabled && 'opacity-50'
                )}
              >
                {(integration.inBetweenSteps || integration.refreshNeeded) && (
                  <div className="absolute left-0 top-0 w-[39px] h-[46px] cursor-pointer">
                    <div className="bg-red-500 w-[15px] h-[15px] rounded-full -left-[5px] -top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
                      !
                    </div>
                    <div className="bg-black/60 w-[39px] h-[46px] left-0 top-0 absolute rounded-full z-[199]" />
                  </div>
                )}
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                  src={integration.picture}
                  className="rounded-full"
                  alt={integration.identifier}
                  width={32}
                  height={32}
                />
                <Image
                  src={`/icons/platforms/${integration.identifier}.png`}
                  className="rounded-full absolute z-10 -bottom-[5px] -right-[5px] border border-fifth"
                  alt={integration.identifier}
                  width={20}
                  height={20}
                />
              </div>
              <div
                className={clsx(
                  'flex-1 whitespace-nowrap text-ellipsis overflow-hidden',
                  integration.disabled && 'opacity-50'
                )}
              >
                {integration.name}
              </div>
            </div>
          ))}
        </div>
      </div>
      {!!options.length && (
        <div className="flex-1 flex flex-col gap-[14px]">
          <div className="max-w-[200px]">
            <Select
              className="bg-[#0A0B14] !border-0"
              label=""
              name="date"
              disableForm={true}
              hideErrors={true}
              onChange={(e) => setKey(+e.target.value)}
            >
              {options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.value}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex-1">
            {!!keys && !!currentIntegration && (
              <RenderAnalytics integration={currentIntegration} date={keys} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
