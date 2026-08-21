<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller\Component;

use App\Controller\Component\PaginationComponent;
use Cake\Controller\ComponentRegistry;
use Cake\Controller\Controller;
use Cake\Http\ServerRequest;
use Cake\ORM\Locator\LocatorAwareTrait;
use Cake\ORM\Query\SelectQuery;
use Cake\TestSuite\TestCase;

/**
 * Tests for App\Controller\Component\PaginationComponent, run against a real
 * query (Organizations, via tests/Fixture/OrganizationsFixture.php — 3
 * fixture rows) so `->count()`/`->all()` exercise actual SQL rather than a
 * mock.
 */
class PaginationComponentTest extends TestCase
{
    use LocatorAwareTrait;

    /**
     * @var array<string>
     */
    protected array $fixtures = ['app.Users', 'app.Organizations'];

    /**
     * @param array<string, mixed> $query Query string params to simulate.
     * @return \App\Controller\Component\PaginationComponent
     */
    private function makeComponent(array $query = []): PaginationComponent
    {
        $request = new ServerRequest(['query' => $query]);
        $controller = new Controller($request);
        $registry = new ComponentRegistry($controller);

        return new PaginationComponent($registry);
    }

    /**
     * @return \Cake\ORM\Query\SelectQuery
     */
    private function orgsQuery(): SelectQuery
    {
        return $this->fetchTable('Organizations')->find();
    }

    /**
     * @return void
     */
    public function testDefaultsToPageOneLimitTwenty(): void
    {
        $result = $this->makeComponent()->paginate($this->orgsQuery());

        $this->assertSame(1, $result['meta']['page']);
        $this->assertSame(20, $result['meta']['limit']);
        $this->assertSame(3, $result['meta']['total']);
        $this->assertSame(1, $result['meta']['totalPages']);
        $this->assertCount(3, $result['data']);
    }

    /**
     * @return void
     */
    public function testMetaShapeHasExactlyTheContractKeys(): void
    {
        $result = $this->makeComponent()->paginate($this->orgsQuery());

        $this->assertSame(['data', 'meta'], array_keys($result));
        $this->assertSame(['page', 'limit', 'total', 'totalPages'], array_keys($result['meta']));
    }

    /**
     * @return void
     */
    public function testLimitIsClampedToMaxOfOneHundred(): void
    {
        $result = $this->makeComponent(['limit' => '500'])->paginate($this->orgsQuery());

        $this->assertSame(100, $result['meta']['limit']);
    }

    /**
     * @return void
     */
    public function testLimitOfZeroFallsBackToDefault(): void
    {
        $result = $this->makeComponent(['limit' => '0'])->paginate($this->orgsQuery());

        $this->assertSame(20, $result['meta']['limit']);
    }

    /**
     * @return void
     */
    public function testNegativeLimitFallsBackToDefault(): void
    {
        $result = $this->makeComponent(['limit' => '-5'])->paginate($this->orgsQuery());

        $this->assertSame(20, $result['meta']['limit']);
    }

    /**
     * @return void
     */
    public function testNonNumericLimitFallsBackToDefault(): void
    {
        $result = $this->makeComponent(['limit' => 'not-a-number'])->paginate($this->orgsQuery());

        $this->assertSame(20, $result['meta']['limit']);
    }

    /**
     * @return void
     */
    public function testPageBelowOneFloorsAtOne(): void
    {
        $result = $this->makeComponent(['page' => '0'])->paginate($this->orgsQuery());
        $this->assertSame(1, $result['meta']['page']);

        $result = $this->makeComponent(['page' => '-3'])->paginate($this->orgsQuery());
        $this->assertSame(1, $result['meta']['page']);
    }

    /**
     * @return void
     */
    public function testNonNumericPageFallsBackToOne(): void
    {
        $result = $this->makeComponent(['page' => 'not-a-number'])->paginate($this->orgsQuery());

        $this->assertSame(1, $result['meta']['page']);
    }

    /**
     * @return void
     */
    public function testSmallLimitPagesDataAndComputesTotalPages(): void
    {
        $page1 = $this->makeComponent(['page' => '1', 'limit' => '2'])->paginate($this->orgsQuery());
        $this->assertCount(2, $page1['data']);
        $this->assertSame(3, $page1['meta']['total']);
        $this->assertSame(2, $page1['meta']['totalPages']);

        $page2 = $this->makeComponent(['page' => '2', 'limit' => '2'])->paginate($this->orgsQuery());
        $this->assertCount(1, $page2['data']);
        $this->assertSame(3, $page2['meta']['total']);
        $this->assertSame(2, $page2['meta']['totalPages']);
    }

    /**
     * @return void
     */
    public function testEmptyResultSetHasZeroTotalPages(): void
    {
        $query = $this->orgsQuery()->where(['owner_id' => 'no-such-owner']);
        $result = $this->makeComponent()->paginate($query);

        $this->assertSame(0, $result['meta']['total']);
        $this->assertSame(0, $result['meta']['totalPages']);
        $this->assertCount(0, $result['data']);
    }

    /**
     * @return void
     */
    public function testExplicitRequestOverridesControllerRequest(): void
    {
        $controllerComponent = $this->makeComponent(['limit' => '1']);
        $explicitRequest = new ServerRequest(['query' => ['limit' => '2']]);

        $result = $controllerComponent->paginate($this->orgsQuery(), $explicitRequest);

        $this->assertSame(2, $result['meta']['limit']);
    }
}
