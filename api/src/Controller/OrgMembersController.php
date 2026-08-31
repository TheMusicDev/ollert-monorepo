<?php
declare(strict_types=1);

namespace App\Controller;

use App\Exception\ApiException;
use App\Model\Entity\Organization;
use App\Model\Entity\OrgMember;
use App\Service\AuditLogService;
use App\Service\OrgAuthorizationService;
use Cake\Http\Response;

/**
 * `/api/orgs/:id/members*` — planning/api-contract.md#org-members.
 *
 * `$this->OrgMembers` is CakePHP's default-table magic property
 * (`Controller::__get()`, driven by the controller's name) — no explicit
 * `fetchTable()` needed for the controller's own primary table, only for the
 * secondary ones (`Organizations`, `Users`) this controller also touches.
 */
class OrgMembersController extends AppController
{
    private OrgAuthorizationService $orgAuth;

    private AuditLogService $auditLog;

    /**
     * @return void
     */
    public function initialize(): void
    {
        parent::initialize();

        $this->loadComponent('Pagination');

        $this->orgAuth = new OrgAuthorizationService();
        $this->auditLog = new AuditLogService();
    }

    /**
     * `GET /api/orgs/:id/members` — paginated list of an org's members.
     *
     * @param string $id Organization id.
     * @return \Cake\Http\Response
     */
    public function index(string $id): Response
    {
        $this->request->allowMethod('GET');
        $userId = $this->currentUserId();

        $this->fetchOrgOrFail($id);
        $this->assertMember($userId, $id);

        $query = $this->OrgMembers->find()
            ->where(['OrgMembers.org_id' => $id])
            ->contain(['Users' => function ($q) {
                return $q->select(['id', 'email', 'display_name']);
            }])
            ->orderBy(['OrgMembers.created' => 'ASC']);

        $result = $this->Pagination->paginate($query);
        $result['data'] = array_map(
            fn(OrgMember $member): array => $member->toArray(),
            iterator_to_array($result['data']),
        );

        return $this->renderJson($result, 200);
    }

    /**
     * `POST /api/orgs/:id/members` — add a member by email. The target must
     * already have an Ollert/Supabase account — 422 `user_not_found` (with
     * a `fields.email` message) when no `users` row matches, following the
     * same "well-formed request, fails a business rule" pattern as
     * `quota_exceeded` (planning/api-contract.md#conventions) rather than a
     * 404, since the email is request-body data, not a URL resource
     * identifier.
     *
     * @param string $id Organization id.
     * @return \Cake\Http\Response
     */
    public function add(string $id): Response
    {
        $this->request->allowMethod('POST');
        $userId = $this->currentUserId();

        $this->fetchOrgOrFail($id);
        $this->assertMember($userId, $id);

        $email = (string)($this->request->getData('email') ?? '');
        $targetUser = $this->fetchTable('Users')
            ->find()
            ->select(['id', 'email', 'display_name'])
            ->where(['email' => $email])
            ->first();

        if ($targetUser === null) {
            throw new ApiException(
                'No account exists for that email address.',
                'user_not_found',
                422,
                ['email' => ['No account exists for that email address.']],
            );
        }

        $member = $this->OrgMembers->newEntity([
            'org_id' => $id,
            'user_id' => $targetUser->id,
        ]);
        $this->OrgMembers->saveOrFail($member);

        $this->auditLog->write(
            $userId,
            $id,
            'org_member',
            (string)$member->id,
            'create',
            $this->auditLog->diffForCreate($member),
        );

        $member->user = $targetUser;

        return $this->renderJson($member->toArray(), 201);
    }

    /**
     * `DELETE /api/orgs/:id/members/:userId` — owner only, or a member
     * removing themself.
     *
     * @param string $id Organization id.
     * @param string $userId Local `users.id` (UUID) of the member to remove.
     * @return \Cake\Http\Response
     */
    public function delete(string $id, string $userId): Response
    {
        $this->request->allowMethod('DELETE');
        $currentUserId = $this->currentUserId();

        $this->fetchOrgOrFail($id);

        $isOwner = $this->orgAuth->isOrgOwner($currentUserId, $id);
        $isSelf = $currentUserId === $userId;
        if (!$isOwner && !$isSelf) {
            throw new ApiException(
                'Only the organization owner can remove another member.',
                'not_org_owner',
                403,
            );
        }

        $member = $this->OrgMembers->find()
            ->where(['org_id' => $id, 'user_id' => $userId])
            ->first();
        if ($member === null) {
            throw new ApiException('That user is not a member of this organization.', 'not_found', 404);
        }

        $diff = $this->auditLog->diffForDelete($member);
        $this->OrgMembers->delete($member);

        $this->auditLog->write($currentUserId, $id, 'org_member', (string)$member->id, 'delete', $diff);

        return $this->noContent();
    }

    /**
     * @return string Local `users.id` (UUID) of the authenticated request.
     */
    private function currentUserId(): string
    {
        /** @var \App\Model\Entity\User $identity */
        $identity = $this->request->getAttribute('identity');

        return $identity->id;
    }

    /**
     * Fetches an org by id (404 `not_found` if missing or soft-deleted — see
     * `Cake\Datasource\Exception\RecordNotFoundException`, which
     * `App\Error\JsonExceptionRenderer` renders with `code: "not_found"`
     * regardless of exception type).
     *
     * @param string $id Organization id.
     * @return \App\Model\Entity\Organization
     */
    private function fetchOrgOrFail(string $id): Organization
    {
        /** @var \App\Model\Entity\Organization */
        return $this->fetchTable('Organizations')->get($id);
    }

    /**
     * @param string $userId Local `users.id` (UUID).
     * @param string $orgId Organization id.
     * @return void
     * @throws \App\Exception\ApiException 403 `not_org_member` if not a member.
     */
    private function assertMember(string $userId, string $orgId): void
    {
        if (!$this->orgAuth->isOrgMember($userId, $orgId)) {
            throw new ApiException('You are not a member of this organization.', 'not_org_member', 403);
        }
    }

    /**
     * @param mixed $data The response payload.
     * @param int $status HTTP status code.
     * @return \Cake\Http\Response
     */
    private function renderJson(mixed $data, int $status): Response
    {
        $this->autoRender = false;

        return $this->response
            ->withStatus($status)
            ->withType('application/json')
            ->withStringBody((string)json_encode(
                $data,
                JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
            ));
    }

    /**
     * @return \Cake\Http\Response 204 No Content.
     */
    private function noContent(): Response
    {
        $this->autoRender = false;

        return $this->response->withStatus(204);
    }
}
