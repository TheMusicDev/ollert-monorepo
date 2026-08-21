<?php
declare(strict_types=1);

namespace App\Test\TestCase\Service;

use App\Exception\ApiException;
use App\Service\QuotaService;
use Cake\ORM\Locator\LocatorAwareTrait;
use Cake\TestSuite\TestCase;
use InvalidArgumentException;

/**
 * Tests for App\Service\QuotaService, using `max_orgs` (fixtures in
 * tests/Fixture/{Users,Organizations}Fixture.php) as the representative
 * quota — the comparison logic (`count >= owner's quota column`) is
 * identical for all four `QuotaService::MAX_*` columns, only the caller's
 * count query differs per planning/data-model.md#quotas.
 *
 * Fixture shape: "member" owns 0 orgs (max_orgs: 1) — under quota. "owner"
 * owns exactly 1 org (max_orgs: 1) — at quota. "poweruser" owns 2 orgs
 * (max_orgs: 1) — over quota.
 */
class QuotaServiceTest extends TestCase
{
    use LocatorAwareTrait;

    /**
     * @var array<string>
     */
    protected array $fixtures = ['app.Users', 'app.Organizations'];

    private const MEMBER_ID = '10000000-0000-4000-8000-000000000002';

    private const OWNER_ID = '10000000-0000-4000-8000-000000000001';

    private const POWER_USER_ID = '10000000-0000-4000-8000-000000000004';

    private QuotaService $service;

    /**
     * @return void
     */
    protected function setUp(): void
    {
        parent::setUp();

        $this->service = new QuotaService();
    }

    /**
     * @param string $ownerId The `users.id` to count owned orgs for.
     * @return \Cake\ORM\Query\SelectQuery
     */
    private function countOrgsOwnedBy(string $ownerId)
    {
        return $this->fetchTable('Organizations')->find()->where(['owner_id' => $ownerId]);
    }

    /**
     * @return void
     */
    public function testUnderQuotaDoesNotThrow(): void
    {
        $this->service->assertUnderQuota(
            $this->countOrgsOwnedBy(self::MEMBER_ID),
            self::MEMBER_ID,
            QuotaService::MAX_ORGS,
            'You have reached your organization quota.',
        );

        $this->addToAssertionCount(1);
    }

    /**
     * @return void
     */
    public function testAtQuotaThrowsApiException(): void
    {
        try {
            $this->service->assertUnderQuota(
                $this->countOrgsOwnedBy(self::OWNER_ID),
                self::OWNER_ID,
                QuotaService::MAX_ORGS,
                'You have reached your organization quota.',
            );
            $this->fail('Expected ApiException to be thrown.');
        } catch (ApiException $exception) {
            $this->assertSame(422, $exception->getCode());
            $this->assertSame('quota_exceeded', $exception->getErrorCode());
            $this->assertSame('You have reached your organization quota.', $exception->getMessage());
        }
    }

    /**
     * @return void
     */
    public function testOverQuotaThrowsApiException(): void
    {
        $this->expectException(ApiException::class);

        $this->service->assertUnderQuota(
            $this->countOrgsOwnedBy(self::POWER_USER_ID),
            self::POWER_USER_ID,
            QuotaService::MAX_ORGS,
            'You have reached your organization quota.',
        );
    }

    /**
     * @return void
     */
    public function testCustomErrorCodeIsUsed(): void
    {
        try {
            $this->service->assertUnderQuota(
                $this->countOrgsOwnedBy(self::OWNER_ID),
                self::OWNER_ID,
                QuotaService::MAX_ORGS,
                'Too many orgs.',
                'org_quota_exceeded',
            );
            $this->fail('Expected ApiException to be thrown.');
        } catch (ApiException $exception) {
            $this->assertSame('org_quota_exceeded', $exception->getErrorCode());
        }
    }

    /**
     * @return void
     */
    public function testUnknownQuotaColumnThrowsInvalidArgumentException(): void
    {
        $this->expectException(InvalidArgumentException::class);

        $this->service->assertUnderQuota(
            $this->countOrgsOwnedBy(self::MEMBER_ID),
            self::MEMBER_ID,
            'not_a_real_quota_column',
            'irrelevant',
        );
    }
}
