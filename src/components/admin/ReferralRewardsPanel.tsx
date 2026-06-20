"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";

type RewardRow = {
  id: string;
  referrerId: string;
  referrerName: string;
  referrerCode: string | null;
  inviteeId: string;
  inviteeName: string;
  credits: number;
  createdAt: string;
};

type Summary = {
  totalRewards: number;
  totalCredits: number;
  uniqueReferrers: number;
};

type RewardData = {
  days: number;
  summary: Summary;
  rewards: RewardRow[];
};

function StatBadge({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[color:var(--gc-border)] bg-[color:var(--gc-surface)] px-4 py-3 text-center">
      <p className="text-xs text-[var(--gc-text-faint)]">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--gc-text)]">{value.toLocaleString()}</p>
    </div>
  );
}

export function ReferralRewardsPanel({
  headers,
  days = 30,
}: {
  headers?: () => HeadersInit;
  days?: number;
}) {
  const t = useTranslations("adminPage");
  const [data, setData] = useState<RewardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/referral-rewards?days=${days}&limit=100`,
        headers ? { headers: headers() } : undefined,
      );
      if (!res.ok) return;
      setData((await res.json()) as RewardData);
      setLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [days, headers]);

  return (
    <div className="space-y-4">
      {!loaded && (
        <div className="flex justify-start">
          <button
            className="rounded-lg border border-[color:var(--gc-border)] bg-[color:var(--gc-surface)] px-4 py-2 text-sm text-[var(--gc-text-soft)] hover:bg-[color:color-mix(in_srgb,var(--gc-border)_30%,var(--gc-surface))] disabled:opacity-50"
            onClick={load}
            disabled={loading}
          >
            {loading ? t("referralRewardsLoading") : t("referralRewardsLoad")}
          </button>
        </div>
      )}

      {loaded && data && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <StatBadge label={t("referralRewardsSummaryTotal")} value={data.summary.totalRewards} />
            <StatBadge label={t("referralRewardsSummaryCredits")} value={data.summary.totalCredits} />
            <StatBadge label={t("referralRewardsSummaryReferrers")} value={data.summary.uniqueReferrers} />
          </div>

          {data.rewards.length === 0 ? (
            <p className="text-sm text-[var(--gc-text-faint)]">{t("referralRewardsEmpty")}</p>
          ) : (
            <div className="overflow-auto rounded-lg border border-[color:var(--gc-border)]">
              <table className="w-full text-xs">
                <thead className="border-b border-[color:var(--gc-border)] bg-[color:color-mix(in_srgb,var(--gc-border)_20%,var(--gc-surface))]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[var(--gc-text-faint)]">
                      {t("referralRewardsColTime")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--gc-text-faint)]">
                      {t("referralRewardsColReferrer")}
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-[var(--gc-text-faint)]">
                      {t("referralRewardsColInvitee")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-[var(--gc-text-faint)]">
                      {t("referralRewardsColCredits")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--gc-border)]">
                  {data.rewards.map((row) => (
                    <tr key={row.id} className="hover:bg-[color:color-mix(in_srgb,var(--gc-border)_10%,transparent)]">
                      <td className="whitespace-nowrap px-3 py-2 text-[var(--gc-text-faint)]">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className="block max-w-[140px] truncate text-[var(--gc-text-soft)]" title={row.referrerId}>
                          {row.referrerName}
                        </span>
                        {row.referrerCode && (
                          <span className="mt-0.5 block text-[10px] text-[var(--gc-text-faint)]">
                            #{row.referrerCode}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="block max-w-[140px] truncate text-[var(--gc-text-soft)]" title={row.inviteeId}>
                          {row.inviteeName}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-[var(--gc-accent)]">
                        +{row.credits}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
