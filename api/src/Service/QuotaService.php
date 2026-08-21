<?php
declare(strict_types=1);

namespace App\Service;

use App\Exception\ApiException;
use Cake\ORM\Locator\LocatorAwareTrait;
use Cake\ORM\Query\SelectQuery;
use InvalidArgumentException;

/**
 * Generic quota-check helper: "count existing rows for X, compare to owner's
 * `max_Y` column, throw 422 `quota_exceeded` if at/over" — parameterized to
 * cover all four quotas on `users` (planning/data-model.md#quotas):
 *
 * - `max_orgs` — checked when a user creates an org.
 * - `max_boards_per_org` — checked when the org's owner creates a board.
 * - `max_lists_per_board` — checked when any org member creates a list,
 *   against the *org owner's* column.
 * - `max_cards_per_board` — checked when any org member creates a card,
 *   against the *org owner's* column, across the whole board.
 *
 * The caller is responsible for building a count query scoped correctly for
 * the resource being created (e.g. `Organizations->find()->where(['owner_id'
 * => $ownerId])`, or a `Cards->find()` joined through `Lists` filtered by
 * `board_id`) — this class only owns the "compare count to the owner's quota
 * column, throw if at/over" part, since that logic is identical across all
 * four quotas even though the counting query differs.
 */
class QuotaService
{
    use LocatorAwareTrait;

    /**
     * @var string
     */
    public const MAX_ORGS = 'max_orgs';

    /**
     * @var string
     */
    public const MAX_BOARDS_PER_ORG = 'max_boards_per_org';

    /**
     * @var string
     */
    public const MAX_LISTS_PER_BOARD = 'max_lists_per_board';

    /**
     * @var string
     */
    public const MAX_CARDS_PER_BOARD = 'max_cards_per_board';

    /**
     * @var array<string>
     */
    private const ALLOWED_QUOTA_COLUMNS = [
        self::MAX_ORGS,
        self::MAX_BOARDS_PER_ORG,
        self::MAX_LISTS_PER_BOARD,
        self::MAX_CARDS_PER_BOARD,
    ];

    /**
     * @var string
     */
    public const DEFAULT_ERROR_CODE = 'quota_exceeded';

    /**
     * Throws a 422 `ApiException` if $countQuery's result count is already at
     * or over the owner's $quotaColumn limit.
     *
     * @param \Cake\ORM\Query\SelectQuery $countQuery Query counting the resource's
     *   existing rows, scoped to whatever the quota is checked against (e.g. an
     *   org's boards, a board's lists/cards) — not executed until this method
     *   calls `->count()` on it.
     * @param string $ownerId `users.id` (UUID) of the quota-owning user — the org
     *   owner in every current usage, per planning/data-model.md#quotas.
     * @param string $quotaColumn One of the `self::MAX_*` constants; the `users`
     *   column holding the limit.
     * @param string $message Human-readable message for the thrown exception.
     * @param string $errorCode Machine-readable `error.code` slug; defaults to
     *   `quota_exceeded`.
     * @return void
     * @throws \App\Exception\ApiException When at/over quota.
     * @throws \InvalidArgumentException When $quotaColumn isn't a recognized quota column.
     */
    public function assertUnderQuota(
        SelectQuery $countQuery,
        string $ownerId,
        string $quotaColumn,
        string $message,
        string $errorCode = self::DEFAULT_ERROR_CODE,
    ): void {
        if (!in_array($quotaColumn, self::ALLOWED_QUOTA_COLUMNS, true)) {
            throw new InvalidArgumentException(sprintf('Unknown quota column "%s".', $quotaColumn));
        }

        /** @var \App\Model\Entity\User $owner */
        $owner = $this->fetchTable('Users')->get($ownerId);
        $limit = (int)$owner->get($quotaColumn);

        $current = $countQuery->count();

        if ($current >= $limit) {
            throw new ApiException($message, $errorCode, 422);
        }
    }
}
