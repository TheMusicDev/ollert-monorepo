<?php
declare(strict_types=1);

namespace App\Controller;

/**
 * Stub for the `/api/lists/:id/cards*` and `/api/cards/:id*` routes (see
 * config/routes.php). Owned by `feat/api-cards` (Section 2, be-tasks.md),
 * which adds the `add`/`edit`/`delete` actions here — see
 * planning/api-contract.md#cards for the contract they implement.
 *
 * Deliberately left with no action methods: CakePHP's controller dispatch
 * throws `Cake\Controller\Exception\MissingActionException` (404) for any
 * requested action that doesn't exist as a method on the controller, which
 * `App\Error\JsonExceptionRenderer` turns into the standard
 * `{ error: { message, code: "not_found" } }` envelope — a clean 404, not a
 * crash — until Section 2 lands the real actions. This keeps this file
 * untouched by every other Section 1/2 branch, so Section 2 branches never
 * collide with each other on it.
 */
class CardsController extends AppController
{
}
