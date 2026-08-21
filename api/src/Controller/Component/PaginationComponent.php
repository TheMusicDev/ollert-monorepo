<?php
declare(strict_types=1);

namespace App\Controller\Component;

use Cake\Controller\Component;
use Cake\Http\ServerRequest;
use Cake\ORM\Query\SelectQuery;

/**
 * Wraps an `index` action's query into the paginated envelope shape used by
 * every collection endpoint in the API (see
 * planning/api-contract.md#pagination):
 *
 * ```json
 * { "data": [...], "meta": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 } }
 * ```
 *
 * Query params: `?page=` (default `1`, floored at `1`) and `?limit=` (default
 * `20`, clamped silently to `[1, 100]` — never an error on an out-of-range or
 * non-numeric value, just clamp/fall back).
 *
 * Usage in a controller action:
 * ```php
 * $result = $this->Pagination->paginate($this->Organizations->find());
 * $this->set($result);
 * $this->viewBuilder()->setOption('serialize', ['data', 'meta']);
 * ```
 */
class PaginationComponent extends Component
{
    /**
     * @var int
     */
    public const DEFAULT_LIMIT = 20;

    /**
     * @var int
     */
    public const MIN_LIMIT = 1;

    /**
     * @var int
     */
    public const MAX_LIMIT = 100;

    /**
     * @var int
     */
    public const DEFAULT_PAGE = 1;

    /**
     * Paginate a query and return the `{ data, meta }` envelope.
     *
     * @param \Cake\ORM\Query\SelectQuery $query The (unlimited/unpaged) query to paginate.
     * @param \Cake\Http\ServerRequest|null $request Request to read `page`/`limit` from;
     *   defaults to the current controller's request.
     * @return array{data: iterable, meta: array{page: int, limit: int, total: int, totalPages: int}}
     */
    public function paginate(SelectQuery $query, ?ServerRequest $request = null): array
    {
        $request ??= $this->getController()->getRequest();

        [$page, $limit] = $this->resolvePageAndLimit($request);

        // Count against a clone so the `limit()`/`offset()` applied below for
        // the actual data fetch don't affect the total count.
        $total = (clone $query)->count();
        $totalPages = $total > 0 ? (int)ceil($total / $limit) : 0;

        $data = $query
            ->limit($limit)
            ->offset(($page - 1) * $limit)
            ->all();

        return [
            'data' => $data,
            'meta' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'totalPages' => $totalPages,
            ],
        ];
    }

    /**
     * Parses and clamps the `page`/`limit` query string params.
     *
     * @param \Cake\Http\ServerRequest $request The request to parse.
     * @return array{0: int, 1: int} `[$page, $limit]`
     */
    protected function resolvePageAndLimit(ServerRequest $request): array
    {
        $page = (int)$request->getQuery('page', self::DEFAULT_PAGE);
        if ($page < 1) {
            $page = self::DEFAULT_PAGE;
        }

        $limit = (int)$request->getQuery('limit', self::DEFAULT_LIMIT);
        if ($limit < self::MIN_LIMIT) {
            $limit = self::DEFAULT_LIMIT;
        } elseif ($limit > self::MAX_LIMIT) {
            $limit = self::MAX_LIMIT;
        }

        return [$page, $limit];
    }
}
