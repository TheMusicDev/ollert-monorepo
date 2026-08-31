<?php
declare(strict_types=1);

namespace App\Test\TestCase\Controller;

use Cake\Cache\Cache;
use Cake\Http\Middleware\CsrfProtectionMiddleware;
use Cake\TestSuite\IntegrationTestTrait;
use Cake\TestSuite\TestCase;
use Firebase\JWT\JWT;
use RuntimeException;

/**
 * Integration tests for `App\Controller\CardsController`
 * (planning/api-contract.md#cards), against the real middleware queue,
 * routing, auth, and fixtures — see tests/Fixture/{Boards,Lists,Cards}Fixture.php
 * for the org/board/list/card ancestry these exercise.
 *
 * Auth: each request is signed with a real RS256 JWT verified through the
 * real `App\Middleware\AuthMiddleware` (same technique as
 * `ApiBootstrapIntegrationTest`), using a fixture user's existing
 * `supabase_uid`/`email` so it resolves to that row rather than
 * JIT-provisioning a new one.
 *
 * CSRF: `Cake\Http\Middleware\CsrfProtectionMiddleware` (wired in
 * `App\Application::middleware()`) validates every POST/PATCH/DELETE
 * request via the double-submit-cookie technique regardless of the bearer
 * token, and — because this app deliberately sends no cookies across the
 * CORS boundary (planning/architecture.md#cors: "Credentials: not sent, not
 * allowed") — a real frontend has no way to ever satisfy it. That's a
 * pre-existing gap in the shared `Application.php` middleware queue
 * (Section 1, out of this branch's scope to fix — flagged in the PR
 * instead), not something specific to cards. Every write test here works
 * around it the same way any caller currently could: prime the same
 * double-submit cookie/header pair the middleware itself would issue on a
 * prior GET, via `primeCsrf()`.
 */
class CardsControllerTest extends TestCase
{
    use IntegrationTestTrait;

    /**
     * @var array<string>
     */
    protected array $fixtures = [
        'app.Users',
        'app.Organizations',
        'app.OrgMembers',
        'app.Boards',
        'app.Lists',
        'app.Cards',
        'app.AuditLogs',
    ];

    private const ISS = 'https://test-project.supabase.co/auth/v1';

    private const AUD = 'authenticated';

    private const KID = 'cards-controller-test-kid';

    private const OWNER_SUB = '20000000-0000-4000-8000-000000000001';

    private const OWNER_EMAIL = 'owner@example.com';

    private const MEMBER_SUB = '20000000-0000-4000-8000-000000000002';

    private const MEMBER_EMAIL = 'member@example.com';

    private const OUTSIDER_SUB = '20000000-0000-4000-8000-000000000003';

    private const OUTSIDER_EMAIL = 'outsider@example.com';

    // "poweruser" (org 3's owner, "Power Org Two") — no relationship to
    // Acme Org (org 1) at all, used for the cross-org-move 403 case below.
    private const POWERUSER_SUB = '20000000-0000-4000-8000-000000000004';

    private const POWERUSER_EMAIL = 'poweruser@example.com';

    // "To Do" / "Done" on "Board One" (BoardsFixture's org 1 — owner
    // 10...01, explicit member 10...02) — reused directly from
    // BoardsControllerTest's shared fixtures rather than adding new rows,
    // since Acme Org's board/list/card counts are pinned exactly by
    // already-merged tests.
    private const LIST_TODO = '60000000-0000-4000-8000-000000000001';

    private const LIST_IN_PROGRESS = '60000000-0000-4000-8000-000000000002';

    // Soft-deleted list on "Board One" — the 404-for-a-trashed-parent case.
    private const LIST_TRASHED = '60000000-0000-4000-8000-000000000009';

    // A "Board One" list too, reused as the cross-org-move target: any
    // list under Acme Org works for that case, since it only needs to be
    // an org "poweruser" has no relationship to.
    private const LIST_OTHER_ORG = '60000000-0000-4000-8000-000000000002';

    // "Card Quota List A" / "Card Quota List B" on "Card Quota Board"
    // (org 3, "Power Org Two" — owner "poweruser", max_cards_per_board 2;
    // member 10...02 is an explicit member of org 3 via OrgMembersFixture).
    private const LIST_QUOTA_A = '60000000-0000-4000-8000-000000000010';

    private const LIST_QUOTA_B = '60000000-0000-4000-8000-000000000011';

    private const CARD_ONE = '70000000-0000-4000-8000-000000000001';

    private const CARD_TWO = '70000000-0000-4000-8000-000000000002';

    private const CARD_TRASHED = '70000000-0000-4000-8000-000000000003';

    // "Quota Card A" on "Card Quota List A" — also the source card for the
    // cross-org-move 403 case ("poweruser" owns it via org 3, but has no
    // relationship to Acme Org).
    private const CARD_QUOTA_A = '70000000-0000-4000-8000-000000000004';

    private const NONEXISTENT_ID = '70000000-0000-4000-8000-000000000999';

    /**
     * @var array<string, string|false>
     */
    private array $originalEnv = [];

    protected function setUp(): void
    {
        parent::setUp();

        Cache::clear('jwks');
        $this->setEnv('SUPABASE_JWT_ISS', self::ISS);
        $this->setEnv('SUPABASE_JWT_AUD', self::AUD);
    }

    protected function tearDown(): void
    {
        Cache::clear('jwks');
        foreach ($this->originalEnv as $key => $value) {
            if ($value === false) {
                unset($_SERVER[$key]);
            } else {
                $_SERVER[$key] = $value;
            }
        }

        parent::tearDown();
    }

    private function setEnv(string $key, string $value): void
    {
        $this->originalEnv[$key] = $_SERVER[$key] ?? false;
        $_SERVER[$key] = $value;
    }

    // --- index / view (reads) -------------------------------------------

    public function testIndexReturnsPaginatedCardsForListMember(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->get('/api/lists/' . self::LIST_TODO . '/cards');

        $this->assertResponseOk();
        $body = $this->decodeBody();
        // "To Do" (`...000001`) has two active cards (Card A, Card B) per
        // CardsFixture, ordered by position ASC.
        $this->assertSame(2, $body['meta']['total']);
        $this->assertCount(2, $body['data']);
        $this->assertSame('Card A', $body['data'][0]['title']);
        $this->assertSame('Card B', $body['data'][1]['title']);
    }

    public function testViewReturnsCard(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->get('/api/cards/' . self::CARD_ONE);

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertSame('Card A', $body['title']);
        $this->assertSame(self::LIST_TODO, $body['list_id']);
        $this->assertSame(self::CARD_ONE, $body['id']);
    }

    public function testIndexIsForbiddenForNonMember(): void
    {
        $this->actingAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->get('/api/lists/' . self::LIST_TODO . '/cards');

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodeBody()['error']['code']);
    }

    public function testIndexReturns404ForTrashedList(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->get('/api/lists/' . self::LIST_TRASHED . '/cards');

        $this->assertResponseCode(404);
        $this->assertSame('not_found', $this->decodeBody()['error']['code']);
    }

    public function testViewOfTrashedCardReturns404(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->get('/api/cards/' . self::CARD_TRASHED);

        $this->assertResponseCode(404);
    }

    public function testViewWithoutTokenIsUnauthorized(): void
    {
        $this->get('/api/cards/' . self::CARD_ONE);

        $this->assertResponseCode(401);
    }

    // --- add -----------------------------------------------------------

    public function testAddCreatesCardForOrgMember(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/lists/' . self::LIST_TODO . '/cards', [
            'title' => 'New Card',
            'description' => 'Some detail',
            'position' => 3.0,
        ]);

        $this->assertResponseCode(201);
        $body = $this->decodeBody();
        $this->assertSame('New Card', $body['title']);
        $this->assertSame('Some detail', $body['description']);
        $this->assertSame(self::LIST_TODO, $body['list_id']);
        $this->assertArrayHasKey('id', $body);

        $this->assertSame(
            1,
            $this->fetchTable('Cards')->find()->where(['title' => 'New Card'])->count(),
        );
    }

    public function testAddReturns403ForNonMember(): void
    {
        $this->actingAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->post('/api/lists/' . self::LIST_TODO . '/cards', [
            'title' => 'Should Not Exist',
            'position' => 1.0,
        ]);

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodeBody()['error']['code']);
    }

    public function testAddReturns404ForNonexistentList(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/lists/' . self::NONEXISTENT_ID . '/cards', [
            'title' => 'X',
            'position' => 1.0,
        ]);

        $this->assertResponseCode(404);
        $this->assertSame('not_found', $this->decodeBody()['error']['code']);
    }

    public function testAddReturns404ForTrashedList(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/lists/' . self::LIST_TRASHED . '/cards', [
            'title' => 'X',
            'position' => 1.0,
        ]);

        $this->assertResponseCode(404);
    }

    public function testAddReturns422WithFieldsWhenValidationFails(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        // Missing required `title` and `position`.
        $this->post('/api/lists/' . self::LIST_TODO . '/cards', []);

        $this->assertResponseCode(422);
        $body = $this->decodeBody();
        $this->assertSame('validation_failed', $body['error']['code']);
        $this->assertArrayHasKey('title', $body['error']['fields']);
    }

    /**
     * `Card::$_accessible` allows mass-assigning `deleted` (the entity also
     * backs `edit`, which legitimately never touches it, so it isn't
     * stripped there) — `add` must not let a client smuggle it in and
     * create an already-trashed card.
     */
    public function testAddIgnoresClientSuppliedDeletedField(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/lists/' . self::LIST_TODO . '/cards', [
            'title' => 'Not Trashed',
            'position' => 4.0,
            'deleted' => '2020-01-01 00:00:00',
        ]);

        $this->assertResponseCode(201);
        $card = $this->fetchTable('Cards')->find()->where(['title' => 'Not Trashed'])->firstOrFail();
        $this->assertNull($card->deleted);
    }

    /**
     * "Card Quota Board"'s owner ("poweruser") has `max_cards_per_board: 2`
     * (`UsersFixture`), and the board already has exactly 2 cards *split
     * across two different lists* (Quota Card A on List A, Quota Card B on
     * List B — `CardsFixture`). Posting to List B — which on its own only
     * has 1 card — must still 422: the quota is counted across every list
     * on the board (planning/data-model.md#quotas), not just the target
     * list. A per-list-only count bug would wrongly allow this (1 < 2).
     */
    public function testAddReturns422WhenBoardWideQuotaExceededAcrossMultipleLists(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->post('/api/lists/' . self::LIST_QUOTA_B . '/cards', [
            'title' => 'One Too Many',
            'position' => 2.0,
        ]);

        $this->assertResponseCode(422);
        $this->assertSame('quota_exceeded', $this->decodeBody()['error']['code']);
        $this->assertSame(
            0,
            $this->fetchTable('Cards')->find()->where(['title' => 'One Too Many'])->count(),
        );
    }

    // --- edit ------------------------------------------------------------

    public function testEditUpdatesTitleDescriptionAndDueDate(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->patch('/api/cards/' . self::CARD_ONE, [
            'title' => 'Renamed',
            'description' => 'Updated detail',
            'due_date' => '2026-03-01',
        ]);

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertSame('Renamed', $body['title']);
        $this->assertSame('Updated detail', $body['description']);
        $this->assertSame('2026-03-01', $body['due_date']);
    }

    public function testEditReordersWithinTheSameList(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->patch('/api/cards/' . self::CARD_ONE, ['position' => 9.5]);

        $this->assertResponseOk();
        $this->assertSame(9.5, $this->decodeBody()['position']);

        $card = $this->fetchTable('Cards')->get(self::CARD_ONE);
        $this->assertSame(self::LIST_TODO, $card->list_id);
        $this->assertSame(9.5, $card->position);
    }

    public function testEditMovesCardToAnotherListInTheSameOrg(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->patch('/api/cards/' . self::CARD_ONE, [
            'list_id' => self::LIST_IN_PROGRESS,
            'position' => 5.0,
        ]);

        $this->assertResponseOk();
        $body = $this->decodeBody();
        $this->assertSame(self::LIST_IN_PROGRESS, $body['list_id']);
        $this->assertSame(5.0, $body['position']);

        $card = $this->fetchTable('Cards')->get(self::CARD_ONE);
        $this->assertSame(self::LIST_IN_PROGRESS, $card->list_id);
    }

    /**
     * "poweruser" (10...04) belongs to "Card Quota Board"'s org (org 3,
     * via ownership) but has no relationship at all to Acme Org (org 1) —
     * moving a card into a list on a board under an org they're not a
     * member of must 403, even though the card being edited is one they
     * otherwise have access to.
     */
    public function testEditReturns403WhenMovingToListInAnOrgTheUserIsNotAMemberOf(): void
    {
        $this->actingAs(self::POWERUSER_SUB, self::POWERUSER_EMAIL);

        $this->patch('/api/cards/' . self::CARD_QUOTA_A, [
            'list_id' => self::LIST_OTHER_ORG,
            'position' => 1.0,
        ]);

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodeBody()['error']['code']);

        $card = $this->fetchTable('Cards')->get(self::CARD_QUOTA_A);
        $this->assertSame(self::LIST_QUOTA_A, $card->list_id);
    }

    public function testEditReturns422ForNonexistentTargetListId(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->patch('/api/cards/' . self::CARD_ONE, [
            'list_id' => self::NONEXISTENT_ID,
        ]);

        $this->assertResponseCode(422);
        $body = $this->decodeBody();
        $this->assertSame('validation_failed', $body['error']['code']);
        $this->assertArrayHasKey('list_id', $body['error']['fields']);
    }

    public function testEditReturns403ForNonMember(): void
    {
        $this->actingAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->patch('/api/cards/' . self::CARD_ONE, ['title' => 'Hijacked']);

        $this->assertResponseCode(403);
        $this->assertSame('not_org_member', $this->decodeBody()['error']['code']);
    }

    public function testEditReturns404ForTrashedCard(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->patch('/api/cards/' . self::CARD_TRASHED, ['title' => 'X']);

        $this->assertResponseCode(404);
    }

    // --- delete ----------------------------------------------------------

    public function testDeleteSoftDeletesCardForOrgMember(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->delete('/api/cards/' . self::CARD_TWO);

        $this->assertResponseCode(204);
        $this->assertSame('', (string)$this->_response->getBody());

        $this->assertNull($this->fetchTable('Cards')->find()->where(['id' => self::CARD_TWO])->first());
        $trashed = $this->fetchTable('Cards')->find('withTrashed')
            ->where(['id' => self::CARD_TWO])
            ->firstOrFail();
        $this->assertNotNull($trashed->deleted);
    }

    public function testDeleteReturns403ForNonMember(): void
    {
        $this->actingAs(self::OUTSIDER_SUB, self::OUTSIDER_EMAIL);

        $this->delete('/api/cards/' . self::CARD_TWO);

        $this->assertResponseCode(403);
        $this->assertNotNull($this->fetchTable('Cards')->find()->where(['id' => self::CARD_TWO])->first());
    }

    public function testDeleteReturns404ForNonexistentCard(): void
    {
        $this->actingAs(self::MEMBER_SUB, self::MEMBER_EMAIL);

        $this->delete('/api/cards/' . self::NONEXISTENT_ID);

        $this->assertResponseCode(404);
    }

    // --- test helpers ------------------------------------------------------

    /**
     * Authenticates the next request as an existing fixture user (matched
     * by `supabase_uid`/`email` so `AuthMiddleware` resolves the existing
     * row instead of provisioning a new one) and primes the CSRF
     * double-submit cookie/header pair `CsrfProtectionMiddleware` requires
     * for unsafe methods — see class docblock.
     *
     * @param string $supabaseUid Matches a `UsersFixture` row's `supabase_uid`.
     * @param string $email Matches that same row's `email`.
     * @return void
     */
    private function actingAs(string $supabaseUid, string $email): void
    {
        [$privateKeyPem, $jwks] = $this->generateJwks();
        Cache::write('supabase_jwks', $jwks, 'jwks');

        $token = JWT::encode([
            'sub' => $supabaseUid,
            'email' => $email,
            'iss' => self::ISS,
            'aud' => self::AUD,
            'iat' => time(),
            'exp' => time() + 3600,
        ], $privateKeyPem, 'RS256', self::KID);

        $csrfToken = (new CsrfProtectionMiddleware())->createToken();
        $this->cookie('csrfToken', $csrfToken);

        $this->configRequest([
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'X-CSRF-Token' => $csrfToken,
            ],
        ]);
    }

    /**
     * @return array<int, mixed> Decoded JSON response body.
     */
    private function decodeBody(): array
    {
        return json_decode((string)$this->_response->getBody(), true) ?? [];
    }

    /**
     * @return array{0: string, 1: array<string, mixed>} [privateKeyPem, jwks]
     */
    private function generateJwks(): array
    {
        $resource = openssl_pkey_new([
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ]);
        if ($resource === false) {
            throw new RuntimeException('Failed to generate a test RSA keypair.');
        }

        openssl_pkey_export($resource, $privateKeyPem);
        /** @var \OpenSSLAsymmetricKey $resource */
        $details = openssl_pkey_get_details($resource);
        $rsa = $details['rsa'];

        $b64url = static fn(string $bin): string => rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');

        $jwks = [
            'keys' => [
                [
                    'kty' => 'RSA',
                    'kid' => self::KID,
                    'alg' => 'RS256',
                    'use' => 'sig',
                    'n' => $b64url($rsa['n']),
                    'e' => $b64url($rsa['e']),
                ],
            ],
        ];

        return [$privateKeyPem, $jwks];
    }
}
