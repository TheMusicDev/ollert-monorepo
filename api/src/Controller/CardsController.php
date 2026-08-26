<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Model\Entity\Card;
use App\Model\Table\CardsTable;
use App\Model\Table\ListsTable;
use App\Model\Table\UsersTable;
use App\Service\OrgAuthorizationService;
use App\Service\QuotaService;
use Cake\Database\Driver\Sqlite;
use Cake\Datasource\Exception\RecordNotFoundException;
use Cake\Http\Response;
use Cake\ORM\Query\SelectQuery;

/**
 * `GET /api/lists/:id/cards`, `GET /api/cards/:id`, `POST /api/lists/:id/cards`,
 * `PATCH /api/cards/:id`, `DELETE /api/cards/:id`
 * (planning/api-contract.md#cards, be-tasks.md `feat/api-cards`).
 *
 * Cards have no direct `org_id` — access control walks
 * `Card belongsTo List belongsTo Board belongsTo Organization` to resolve the
 * owning org for every 403 check, via `App\Service\OrgAuthorizationService`.
 * Every action requires the acting user to be a member of that org (any
 * member, not owner-only — cards have no owner-gated action per the
 * contract).
 *
 * This controller renders responses by hand (`autoRender = false` +
 * `Response::withStringBody()`), the same pattern `HealthController` uses —
 * no view templates exist for the JSON API, and `Cake\ORM\Entity` already
 * implements `JsonSerializable`, so `json_encode()`ing an entity/array
 * directly produces the same body a `JsonView` + `serialize` option pipeline
 * would.
 */
class CardsController extends AppController
{
    /**
     * @var \App\Service\OrgAuthorizationService|null
     */
    private ?OrgAuthorizationService $orgAuthorization = null;

    /**
     * `index`/`view` render through JsonView + `serialize` (paginated
     * `{data,meta}` envelope / single entity), mirroring BoardsController.
     * The existing `add`/`edit`/`delete` return a Response from
     * `jsonResponse()` (which sets `autoRender = false` itself), so the
     * `Json` view class + `Pagination` component added here don't affect them.
     *
     * @return void
     */
    public function initialize(): void
    {
        parent::initialize();

        $this->loadComponent('Pagination');
        $this->viewBuilder()->setClassName('Json');
        // Matches `jsonResponse()`'s flags (incl. `JSON_PRESERVE_ZERO_FRACTION`
        // for whole-number `position`) so the serialize path is byte-identical
        // to the manual path for the same entity.
        $this->viewBuilder()->setOption(
            'jsonOptions',
            JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
                | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PRESERVE_ZERO_FRACTION,
        );
    }

    /**
     * `GET /api/lists/:id/cards` — cards under a list, paginated
     * (`{data,meta}` envelope, planning/api-contract.md#pagination). Any org
     * member. Ordered by `position` ASC.
     *
     * @param string $listId The parent list's id (route `:id`).
     * @return void
     */
    public function index(string $listId): void
    {
        $this->request->allowMethod('GET');

        $userId = $this->currentUserId();
        $list = $this->findListWithBoardAndOrg($listId);
        $this->assertOrgMember($userId, $list->board->org_id);

        $query = $this->fetchCardsTable()->find()
            ->where(['list_id' => $list->id])
            ->orderBy(['position' => 'ASC']);
        $result = $this->Pagination->paginate($query);

        $this->set($result);
        $this->viewBuilder()->setOption('serialize', ['data', 'meta']);
    }

    /**
     * `GET /api/cards/:id` — card detail. Any member of the card's org.
     *
     * @param string $id The card's id.
     * @return void
     */
    public function view(string $id): void
    {
        $this->request->allowMethod('GET');

        $userId = $this->currentUserId();
        $card = $this->findCardWithListBoardAndOrg($id);
        $this->assertOrgMember($userId, $card->list->board->org_id);

        $this->set('card', $card);
        $this->viewBuilder()->setOption('serialize', 'card');
    }

    /**
     * `POST /api/lists/:id/cards` — create a card under a list. Any org
     * member. 422 `quota_exceeded` against `max_cards_per_board`, counted
     * across every list on the card's board (planning/data-model.md#quotas),
     * not just the target list — so the count query joins through `Lists`
     * filtered by `board_id`, not `list_id`.
     *
     * The count-check and the save are wrapped in one transaction, with a
     * locking read of the quota-owning user row first, per
     * `QuotaService`'s documented non-atomicity caveat: without the lock,
     * two concurrent creates for the same board's owner could both pass the
     * count check before either insert commits.
     *
     * @param string $listId The parent list's id (route `:id`).
     * @return \Cake\Http\Response
     */
    public function add(string $listId): Response
    {
        $this->request->allowMethod('POST');

        $userId = $this->currentUserId();
        $list = $this->findListWithBoardAndOrg($listId);
        $orgId = $list->board->org_id;
        $ownerId = $list->board->organization->owner_id;

        $this->assertOrgMember($userId, $orgId);

        $cardsTable = $this->fetchCardsTable();
        $usersTable = $this->fetchUsersTable();
        $boardId = $list->board_id;
        $data = $this->request->getData();
        $data['list_id'] = $listId;

        $card = $cardsTable->getConnection()->transactional(
            function () use ($cardsTable, $usersTable, $ownerId, $boardId, $data): Card {
                $this->lockOwnerRow($usersTable, $ownerId);

                (new QuotaService())->assertUnderQuota(
                    $this->cardsOnBoardQuery($cardsTable, $boardId),
                    $ownerId,
                    QuotaService::MAX_CARDS_PER_BOARD,
                    'This board has reached its card quota.',
                );

                $entity = $cardsTable->newEntity($data, [
                    'fields' => ['title', 'description', 'due_date', 'position', 'list_id'],
                ]);

                return $cardsTable->saveOrFail($entity);
            },
        );

        return $this->jsonResponse($card, 201);
    }

    /**
     * `PATCH /api/cards/:id` — update title/description/due_date/position,
     * including moving the card to a different `list_id` (cross-list move).
     * Any member of the card's *current* org.
     *
     * All fields are optional and independent (partial-update semantics):
     * a rename sends just `title`; a same-list reorder sends just
     * `position`; a cross-list drag-drop sends `list_id` + `position`
     * together, per planning/api-contract.md#conventions. `list_id` alone
     * is also accepted, since `CardsTable` doesn't require `position` on
     * update either.
     *
     * A cross-list move also requires membership in the *target* list's
     * org, not just the source — `list_id` is a client-controlled body
     * value, so without this check a member of one org could relocate a
     * card into a board under an org they have no access to.
     *
     * @param string $id The card's id.
     * @return \Cake\Http\Response
     */
    public function edit(string $id): Response
    {
        $this->request->allowMethod('PATCH');

        $userId = $this->currentUserId();
        $card = $this->findCardWithListBoardAndOrg($id);
        $currentOrgId = $card->list->board->org_id;

        $this->assertOrgMember($userId, $currentOrgId);

        $data = $this->request->getData();
        $newListId = $data['list_id'] ?? null;
        if ($newListId !== null && $newListId !== $card->list_id) {
            $targetList = $this->findListWithBoardAndOrg((string)$newListId, 'list_id');
            $this->assertOrgMember($userId, $targetList->board->org_id);
        }

        $cardsTable = $this->fetchCardsTable();
        $cardsTable->patchEntity($card, $data, [
            'fields' => ['title', 'description', 'due_date', 'position', 'list_id'],
        ]);
        $card = $cardsTable->saveOrFail($card);

        return $this->jsonResponse($card, 200);
    }

    /**
     * `DELETE /api/cards/:id` — soft delete (automatic via `TrashBehavior`).
     * Any member of the card's org.
     *
     * @param string $id The card's id.
     * @return \Cake\Http\Response
     */
    public function delete(string $id): Response
    {
        $this->request->allowMethod('DELETE');

        $userId = $this->currentUserId();
        $card = $this->findCardWithListBoardAndOrg($id);
        $orgId = $card->list->board->org_id;

        $this->assertOrgMember($userId, $orgId);

        $this->fetchCardsTable()->delete($card);

        return $this->jsonResponse(null, 204);
    }

    /**
     * @return string Local `users.id` (UUID) of the authenticated request,
     *   set by `App\Middleware\AuthMiddleware`.
     */
    private function currentUserId(): string
    {
        /** @var \App\Model\Entity\User $identity */
        $identity = $this->request->getAttribute('identity');

        return $identity->id;
    }

    /**
     * @param string $userId Local `users.id` (UUID).
     * @param string $orgId `organizations.id` (UUID).
     * @return void
     * @throws \App\Exception\ApiException 403 `not_org_member` when the user
     *   isn't a member of the org (see `App\Service\OrgAuthorizationService`
     *   for what counts as membership).
     */
    private function assertOrgMember(string $userId, string $orgId): void
    {
        if (!$this->orgAuthorizationService()->isOrgMember($userId, $orgId)) {
            throw new ApiException('You are not a member of this organization.', 'not_org_member', 403);
        }
    }

    /**
     * @return \App\Service\OrgAuthorizationService
     */
    private function orgAuthorizationService(): OrgAuthorizationService
    {
        return $this->orgAuthorization ??= new OrgAuthorizationService();
    }

    /**
     * Loads a list with its board and the board's org, 404ing (as the
     * standard `not_found` envelope) for a nonexistent or soft-deleted list
     * — used both for the `add` route's parent list and for `edit`'s
     * cross-list-move target validation.
     *
     * @param string $listId The list's id.
     * @param string $context Distinguishes the error field used when this
     *   lookup is for a client-supplied `list_id` body value (`edit`'s
     *   cross-list move) vs. the route's own `:id` (`add`) — see call sites.
     * @return \App\Model\Entity\BoardList
     * @throws \App\Exception\ApiException 404 `not_found` (route-sourced id)
     *   or 422 `validation_failed` (body-sourced `list_id`) when the list
     *   doesn't exist or is soft-deleted.
     */
    private function findListWithBoardAndOrg(string $listId, string $context = 'id')
    {
        try {
            return $this->fetchListsTable()->find()
                ->where(['Lists.id' => $listId])
                ->contain(['Boards' => ['Organizations']])
                ->firstOrFail();
        } catch (RecordNotFoundException $exception) {
            if ($context === 'list_id') {
                throw new ApiException(
                    'The target list does not exist.',
                    'validation_failed',
                    422,
                    ['list_id' => ['The target list does not exist.']],
                    $exception,
                );
            }

            throw new ApiException('List not found.', 'not_found', 404, null, $exception);
        }
    }

    /**
     * Loads a card with its list, the list's board, and the board's org
     * (for org-membership resolution), 404ing for a nonexistent or
     * soft-deleted card.
     *
     * @param string $id The card's id.
     * @return \App\Model\Entity\Card
     * @throws \App\Exception\ApiException 404 `not_found`.
     */
    private function findCardWithListBoardAndOrg(string $id): Card
    {
        try {
            /** @var \App\Model\Entity\Card */
            return $this->fetchCardsTable()->find()
                ->where(['Cards.id' => $id])
                ->contain(['Lists' => ['Boards' => ['Organizations']]])
                ->firstOrFail();
        } catch (RecordNotFoundException $exception) {
            throw new ApiException('Card not found.', 'not_found', 404, null, $exception);
        }
    }

    /**
     * Count query for `max_cards_per_board`: every non-trashed card whose
     * list belongs to $boardId. Board-scoped, not list-scoped, per
     * planning/data-model.md#quotas: counted across the whole board.
     *
     * @param \App\Model\Table\CardsTable $cardsTable The Cards table.
     * @param string $boardId The board's id.
     * @return \Cake\ORM\Query\SelectQuery
     */
    private function cardsOnBoardQuery(CardsTable $cardsTable, string $boardId): SelectQuery
    {
        return $cardsTable->find()
            ->matching('Lists', function (SelectQuery $query) use ($boardId): SelectQuery {
                return $query->where(['Lists.board_id' => $boardId]);
            });
    }

    /**
     * Takes a row lock on the quota-owning user, inside the caller's
     * transaction, so two concurrent `add` requests for the same board's
     * owner serialize instead of both passing the count check before
     * either insert commits (`QuotaService`'s documented concurrency
     * caveat).
     *
     * `SELECT ... FOR UPDATE` isn't supported by SQLite (used for this
     * branch's isolated test run — see api/.env); MySQL/MariaDB is the only
     * driver this ever runs against outside tests
     * (planning/architecture.md#tech-stack), so the lock is skipped on
     * SQLite rather than gated behind a feature-detection call. SQLite's
     * own file-level write locking still prevents actual corruption there,
     * just without the guaranteed request ordering `FOR UPDATE` gives on
     * MySQL.
     *
     * @param \App\Model\Table\UsersTable $usersTable The Users table.
     * @param string $ownerId The quota-owning user's id.
     * @return void
     */
    private function lockOwnerRow(UsersTable $usersTable, string $ownerId): void
    {
        $query = $usersTable->find()->where(['id' => $ownerId]);
        if (!$usersTable->getConnection()->getDriver() instanceof Sqlite) {
            $query->epilog('FOR UPDATE');
        }

        $query->firstOrFail();
    }

    /**
     * @return \App\Model\Table\CardsTable
     */
    private function fetchCardsTable(): CardsTable
    {
        /** @var \App\Model\Table\CardsTable */
        return $this->fetchTable('Cards');
    }

    /**
     * @return \App\Model\Table\ListsTable
     */
    private function fetchListsTable(): ListsTable
    {
        /** @var \App\Model\Table\ListsTable */
        return $this->fetchTable('Lists');
    }

    /**
     * @return \App\Model\Table\UsersTable
     */
    private function fetchUsersTable(): UsersTable
    {
        /** @var \App\Model\Table\UsersTable */
        return $this->fetchTable('Users');
    }

    /**
     * Builds the JSON response manually — see class docblock for why (no
     * view templates/`JsonView` wiring exists for this API yet).
     *
     * @param mixed $data The value to encode as the response body, or null
     *   for a bodyless response (e.g. 204).
     * @param int $status HTTP status code.
     * @return \Cake\Http\Response
     */
    private function jsonResponse(mixed $data, int $status): Response
    {
        $this->autoRender = false;
        $response = $this->response->withStatus($status);

        if ($data === null) {
            return $response;
        }

        // JSON_PRESERVE_ZERO_FRACTION keeps a whole-number `position` (e.g.
        // 5.0) encoded as "5.0" rather than "5" — the frontend/data model
        // treat `position` as a float (planning/data-model.md#lists), and
        // an integer-looking value on the wire would be a silent type
        // change for any strict client-side parsing.
        $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE
            | JSON_INVALID_UTF8_SUBSTITUTE | JSON_PRESERVE_ZERO_FRACTION;
        $body = (string)json_encode($data, $flags);

        return $response->withType('application/json')->withStringBody($body);
    }
}
