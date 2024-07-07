'use client';

import { Slider } from '@gitroom/react/form/slider';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gitroom/react/form/button';
import { sortBy } from 'lodash';
import { Track } from '@gitroom/react/form/track';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Subscription } from '@prisma/client';
import { useDebouncedCallback } from 'use-debounce';
import ReactLoading from 'react-loading';
import { deleteDialog } from '@gitroom/react/helpers/delete.dialog';
import { useToaster } from '@gitroom/react/toaster/toaster';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { pricing } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { FAQComponent } from '@gitroom/frontend/components/billing/faq.component';
import { useSWRConfig } from 'swr';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import interClass from '@gitroom/react/helpers/inter.font';
import { useRouter } from 'next/navigation';

export interface Tiers {
  month: Array<{
    name: 'Pro' | 'Standard';
    recurring: 'month' | 'year';
    price: number;
  }>;
  year: Array<{
    name: 'Pro' | 'Standard';
    recurring: 'month' | 'year';
    price: number;
  }>;
}

export const Prorate: FC<{
  period: 'MONTHLY' | 'YEARLY';
  pack: 'STANDARD' | 'PRO';
}> = (props) => {
  const { period, pack } = props;
  const fetch = useFetch();
  const [price, setPrice] = useState<number | false>(0);
  const [loading, setLoading] = useState(false);

  const calculatePrice = useDebouncedCallback(async () => {
    setLoading(true);
    setPrice(
      (
        await (
          await fetch('/billing/prorate', {
            method: 'POST',
            body: JSON.stringify({
              period,
              billing: pack,
            }),
          })
        ).json()
      ).price
    );
    setLoading(false);
  }, 500);

  useEffect(() => {
    setPrice(false);
    calculatePrice();
  }, [period, pack]);

  if (loading) {
    return (
      <div className="pt-[12px]">
        <ReactLoading type="spin" color="#fff" width={20} height={20} />
      </div>
    );
  }

  if (price === false) {
    return null;
  }

  return (
    <div className="text-[12px] flex pt-[12px]">
      (Pay Today ${(price < 0 ? 0 : price).toFixed(1)})
    </div>
  );
};

export const Features: FC<{
  pack: 'FREE' | 'STANDARD' | 'PRO';
}> = (props) => {
  const { pack } = props;
  const features = useMemo(() => {
    const currentPricing = pricing[pack];
    const channelsOr = currentPricing.channel;
    const list = [];
    list.push(`${channelsOr} ${channelsOr === 1 ? 'channel' : 'channels'}`);
    list.push(
      `${
        currentPricing.posts_per_month > 10000
          ? 'Unlimited'
          : currentPricing.posts_per_month
      } posts per month`
    );
    if (currentPricing.team_members) {
      list.push(`Unlimited team members`);
    }

    if (currentPricing?.ai) {
      list.push(`AI auto-complete`);
    }

    return list;
  }, [pack]);

  return (
    <div className="flex flex-col gap-[10px] justify-center text-[16px] text-[#AAA]">
      {features.map((feature) => (
        <div key={feature} className="flex gap-[20px]">
          <div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M16.2806 9.21937C16.3504 9.28903 16.4057 9.37175 16.4434 9.46279C16.4812 9.55384 16.5006 9.65144 16.5006 9.75C16.5006 9.84856 16.4812 9.94616 16.4434 10.0372C16.4057 10.1283 16.3504 10.211 16.2806 10.2806L11.0306 15.5306C10.961 15.6004 10.8783 15.6557 10.7872 15.6934C10.6962 15.7312 10.5986 15.7506 10.5 15.7506C10.4014 15.7506 10.3038 15.7312 10.2128 15.6934C10.1218 15.6557 10.039 15.6004 9.96938 15.5306L7.71938 13.2806C7.57865 13.1399 7.49959 12.949 7.49959 12.75C7.49959 12.551 7.57865 12.3601 7.71938 12.2194C7.86011 12.0786 8.05098 11.9996 8.25 11.9996C8.44903 11.9996 8.6399 12.0786 8.78063 12.2194L10.5 13.9397L15.2194 9.21937C15.289 9.14964 15.3718 9.09432 15.4628 9.05658C15.5538 9.01884 15.6514 8.99941 15.75 8.99941C15.8486 8.99941 15.9462 9.01884 16.0372 9.05658C16.1283 9.09432 16.211 9.14964 16.2806 9.21937ZM21.75 12C21.75 13.9284 21.1782 15.8134 20.1068 17.4168C19.0355 19.0202 17.5127 20.2699 15.7312 21.0078C13.9496 21.7458 11.9892 21.9389 10.0979 21.5627C8.20656 21.1865 6.46928 20.2579 5.10571 18.8943C3.74215 17.5307 2.81355 15.7934 2.43735 13.9021C2.06114 12.0108 2.25422 10.0504 2.99218 8.26884C3.73013 6.48726 4.97982 4.96451 6.58319 3.89317C8.18657 2.82183 10.0716 2.25 12 2.25C14.585 2.25273 17.0634 3.28084 18.8913 5.10872C20.7192 6.93661 21.7473 9.41498 21.75 12ZM20.25 12C20.25 10.3683 19.7661 8.77325 18.8596 7.41655C17.9531 6.05984 16.6646 5.00242 15.1571 4.37799C13.6497 3.75357 11.9909 3.59019 10.3905 3.90852C8.79017 4.22685 7.32016 5.01259 6.16637 6.16637C5.01259 7.32015 4.22685 8.79016 3.90853 10.3905C3.5902 11.9908 3.75358 13.6496 4.378 15.1571C5.00242 16.6646 6.05984 17.9531 7.41655 18.8596C8.77326 19.7661 10.3683 20.25 12 20.25C14.1873 20.2475 16.2843 19.3775 17.8309 17.8309C19.3775 16.2843 20.2475 14.1873 20.25 12Z"
                fill="#06ff00"
              />
            </svg>
          </div>
          <div>{feature}</div>
        </div>
      ))}
    </div>
  );
};

export const MainBillingComponent: FC<{
  sub?: Subscription;
}> = (props) => {
  const { sub } = props;
  const { mutate } = useSWRConfig();
  const fetch = useFetch();
  const toast = useToaster();
  const user = useUser();
  const router = useRouter();

  const [subscription, setSubscription] = useState<Subscription | undefined>(
    sub
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>(
    subscription?.period || 'MONTHLY'
  );
  const [monthlyOrYearly, setMonthlyOrYearly] = useState<'on' | 'off'>(
    period === 'MONTHLY' ? 'off' : 'on'
  );

  const [initialChannels, setInitialChannels] = useState(
    sub?.totalChannels || 1
  );

  useEffect(() => {
    if (initialChannels !== sub?.totalChannels) {
      setInitialChannels(sub?.totalChannels || 1);
    }

    if (period !== sub?.period) {
      setPeriod(sub?.period || 'MONTHLY');
      setMonthlyOrYearly(
        (sub?.period || 'MONTHLY') === 'MONTHLY' ? 'off' : 'on'
      );
    }

    setSubscription(sub);
  }, [sub]);

  const updatePayment = useCallback(async () => {
    const { portal } = await (await fetch('/billing/portal')).json();
    window.location.href = portal;
  }, []);

  const currentPackage = useMemo(() => {
    if (!subscription) {
      return 'FREE';
    }

    if (period === 'YEARLY' && monthlyOrYearly === 'off') {
      return '';
    }

    if (period === 'MONTHLY' && monthlyOrYearly === 'on') {
      return '';
    }

    return subscription?.subscriptionTier;
  }, [subscription, initialChannels, monthlyOrYearly, period]);

  const moveToCheckout = useCallback(
    (billing: 'STANDARD' | 'PRO' | 'FREE') => async () => {
      const messages = [];

      if (
        !pricing[billing].team_members &&
        pricing[subscription?.subscriptionTier!]?.team_members
      ) {
        messages.push(
          `Your team members will be removed from your organization`
        );
      }

      if (billing === 'FREE') {
        if (
          subscription?.cancelAt ||
          (await deleteDialog(
            `Are you sure you want to cancel your subscription? ${messages.join(
              ', '
            )}`,
            'Yes, cancel',
            'Cancel Subscription'
          ))
        ) {
          setLoading(true);
          const { cancel_at } = await (
            await fetch('/billing/cancel', {
              method: 'POST',
            })
          ).json();

          setSubscription((subs) => ({ ...subs!, cancelAt: cancel_at }));
          if (cancel_at)
            toast.show('Subscription set to canceled successfully');
          if (!cancel_at) toast.show('Subscription reactivated successfully');

          setLoading(false);
        }
        return;
      }

      if (
        messages.length &&
        !(await deleteDialog(messages.join(', '), 'Yes, continue'))
      ) {
        return;
      }

      setLoading(true);
      const { url, portal } = await (
        await fetch('/billing/subscribe', {
          method: 'POST',
          body: JSON.stringify({
            period: monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY',
            billing,
          }),
        })
      ).json();

      if (url) {
        window.location.href = url;
        return;
      }

      if (portal) {
        if (
          await deleteDialog(
            'We could not charge your credit card, please update your payment method',
            'Update',
            'Payment Method Required'
          )
        ) {
          window.open(portal);
        }
      } else {
        setPeriod(monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY');
        setSubscription((subs) => ({
          ...subs!,
          subscriptionTier: billing,
          cancelAt: null,
        }));
        mutate(
          '/user/self',
          {
            ...user,
            tier: billing,
          },
          {
            revalidate: false,
          }
        );
        toast.show('Subscription updated successfully');
      }

      setLoading(false);
    },
    [monthlyOrYearly, subscription, user]
  );

  if (user?.isLifetime) {
    router.replace('/billing/lifetime');
    return null;
  }

  return (
    <div className="flex flex-col gap-[16px]">
      <div className="flex flex-row">
        <div className="flex-1 text-[20px]">Plans</div>
        <div className="flex items-center gap-[16px]">
          <div>MONTHLY</div>
          <div>
            <Slider value={monthlyOrYearly} onChange={setMonthlyOrYearly} />
          </div>
          <div>YEARLY</div>
        </div>
      </div>
      <div className="flex gap-[16px]">
        {Object.entries(pricing).map(([name, values]) => (
          <div
            key={name}
            className="flex-1 bg-sixth border border-[#172034] rounded-[4px] p-[24px] gap-[16px] flex flex-col"
          >
            <div className="text-[18px]">{name}</div>
            <div className="text-[38px] flex gap-[2px] items-center">
              <div>
                $
                {monthlyOrYearly === 'on'
                  ? values.year_price
                  : values.month_price}
              </div>
              <div className={`text-[14px] ${interClass} text-[#AAA]`}>
                {monthlyOrYearly === 'on' ? '/year' : '/month'}
              </div>
            </div>
            <div className="text-[14px] flex gap-[10px]">
              {currentPackage === name.toUpperCase() &&
              subscription?.cancelAt ? (
                <div className="gap-[3px] flex flex-col">
                  <div>
                    <Button onClick={moveToCheckout('FREE')} loading={loading}>
                      Reactivate subscription
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  loading={loading}
                  disabled={
                    (!!subscription?.cancelAt &&
                      name.toUpperCase() === 'FREE') ||
                    currentPackage === name.toUpperCase()
                  }
                  className={clsx(
                    subscription &&
                      name.toUpperCase() === 'FREE' &&
                      '!bg-red-500'
                  )}
                  onClick={moveToCheckout(
                    name.toUpperCase() as 'STANDARD' | 'PRO'
                  )}
                >
                  {currentPackage === name.toUpperCase()
                    ? 'Current Plan'
                    : name.toUpperCase() === 'FREE'
                    ? subscription?.cancelAt
                      ? `Downgrade on ${dayjs
                          .utc(subscription?.cancelAt)
                          .local()
                          .format('D MMM, YYYY')}`
                      : 'Cancel subscription'
                    : 'Purchase Plan'}
                </Button>
              )}
              {subscription &&
                currentPackage !== name.toUpperCase() &&
                name !== 'FREE' &&
                !!name && (
                  <Prorate
                    period={monthlyOrYearly === 'on' ? 'YEARLY' : 'MONTHLY'}
                    pack={name.toUpperCase() as 'STANDARD' | 'PRO'}
                  />
                )}
            </div>
            <Features
              pack={name.toUpperCase() as 'FREE' | 'STANDARD' | 'PRO'}
            />
          </div>
        ))}
      </div>
      {!!subscription?.id && (
        <div className="flex justify-center mt-[20px]">
          <Button onClick={updatePayment}>Update Payment Method</Button>
        </div>
      )}
      <FAQComponent />
    </div>
  );
};
