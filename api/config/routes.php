<?php
/**
 * Routes configuration.
 *
 * In this file, you set up routes to your controllers and their actions.
 * Routes are very important mechanism that allows you to freely connect
 * different URLs to chosen controllers and their actions (functions).
 *
 * It's loaded within the context of `Application::routes()` method which
 * receives a `RouteBuilder` instance `$routes` as method argument.
 *
 * CakePHP(tm) : Rapid Development Framework (https://cakephp.org)
 * Copyright (c) Cake Software Foundation, Inc. (https://cakefoundation.org)
 *
 * Licensed under The MIT License
 * For full copyright and license information, please see the LICENSE.txt
 * Redistributions of files must retain the above copyright notice.
 *
 * @copyright     Copyright (c) Cake Software Foundation, Inc. (https://cakefoundation.org)
 * @link          https://cakephp.org CakePHP(tm) Project
 * @license       https://opensource.org/licenses/mit-license.php MIT License
 */

use Cake\Routing\Route\DashedRoute;
use Cake\Routing\RouteBuilder;

/*
 * This file is loaded in the context of the `Application` class.
 * So you can use `$this` to reference the application class instance
 * if required.
 */
return function (RouteBuilder $routes): void {
    /*
     * The default class to use for all routes
     *
     * The following route classes are supplied with CakePHP and are appropriate
     * to set as the default:
     *
     * - Route
     * - InflectedRoute
     * - DashedRoute
     *
     * If no call is made to `Router::defaultRouteClass()`, the class used is
     * `Route` (`Cake\Routing\Route\Route`)
     *
     * Note that `Route` does not do any inflections on URLs which will result in
     * inconsistently cased URLs when used with `{plugin}`, `{controller}` and
     * `{action}` markers.
     */
    $routes->setRouteClass(DashedRoute::class);

    $routes->scope('/', function (RouteBuilder $builder): void {
        /*
         * Here, we are connecting '/' (base path) to a controller called 'Pages',
         * its action called 'display', and we pass a param to select the view file
         * to use (in this case, templates/Pages/home.php)...
         */
        $builder->connect('/', ['controller' => 'Pages', 'action' => 'display', 'home']);

        /*
         * ...and connect the rest of 'Pages' controller's URLs.
         */
        $builder->connect('/pages/*', 'Pages::display');

        /*
         * Connect catchall routes for all controllers.
         *
         * The `fallbacks` method is a shortcut for
         *
         * ```
         * $builder->connect('/{controller}', ['action' => 'index']);
         * $builder->connect('/{controller}/{action}/*', []);
         * ```
         *
         * It is NOT recommended to use fallback routes after your initial prototyping phase!
         * See https://book.cakephp.org/5/en/development/routing.html#fallbacks-method for more information
         */
        $builder->fallbacks();
    });

    /*
     * JSON REST API, per planning/api-contract.md#endpoints. Auth (all routes
     * except /api/health require a Supabase Bearer JWT) is applied by
     * `feat/api-auth-middleware`'s middleware, not here — this scope only
     * wires URLs to controllers/actions.
     *
     * Controllers are referenced by name only; the stub controller *files*
     * (`feat/api-stubs`) and their real implementations (Section 2 branches)
     * land separately — CakePHP resolves controller classes lazily per
     * request, so this doesn't require those files to exist yet.
     */
    $routes->scope('/api', function (RouteBuilder $builder): void {
        $builder->get('/health', ['controller' => 'Health', 'action' => 'index']);

        // Organizations
        $builder->get('/orgs', ['controller' => 'Organizations', 'action' => 'index']);
        $builder->post('/orgs', ['controller' => 'Organizations', 'action' => 'add']);
        $builder->get('/orgs/{id}', ['controller' => 'Organizations', 'action' => 'view'])->setPass(['id']);
        $builder->patch('/orgs/{id}', ['controller' => 'Organizations', 'action' => 'edit'])->setPass(['id']);
        $builder->delete('/orgs/{id}', ['controller' => 'Organizations', 'action' => 'delete'])->setPass(['id']);

        // Org Members
        $builder->get('/orgs/{id}/members', ['controller' => 'OrgMembers', 'action' => 'index'])
            ->setPass(['id']);
        $builder->post('/orgs/{id}/members', ['controller' => 'OrgMembers', 'action' => 'add'])
            ->setPass(['id']);
        $builder->delete(
            '/orgs/{id}/members/{userId}',
            ['controller' => 'OrgMembers', 'action' => 'delete'],
        )->setPass(['id', 'userId']);

        // Boards
        $builder->get('/orgs/{id}/boards', ['controller' => 'Boards', 'action' => 'index'])
            ->setPass(['id']);
        $builder->post('/orgs/{id}/boards', ['controller' => 'Boards', 'action' => 'add'])
            ->setPass(['id']);
        $builder->get('/boards/{id}', ['controller' => 'Boards', 'action' => 'view'])->setPass(['id']);
        $builder->patch('/boards/{id}', ['controller' => 'Boards', 'action' => 'edit'])->setPass(['id']);
        $builder->delete('/boards/{id}', ['controller' => 'Boards', 'action' => 'delete'])->setPass(['id']);

        // Lists
        $builder->get('/boards/{id}/lists', ['controller' => 'Lists', 'action' => 'index'])
            ->setPass(['id']);
        $builder->post('/boards/{id}/lists', ['controller' => 'Lists', 'action' => 'add'])
            ->setPass(['id']);
        $builder->get('/lists/{id}', ['controller' => 'Lists', 'action' => 'view'])->setPass(['id']);
        $builder->patch('/lists/{id}', ['controller' => 'Lists', 'action' => 'edit'])->setPass(['id']);
        $builder->delete('/lists/{id}', ['controller' => 'Lists', 'action' => 'delete'])->setPass(['id']);

        // Cards
        $builder->get('/lists/{id}/cards', ['controller' => 'Cards', 'action' => 'index'])
            ->setPass(['id']);
        $builder->post('/lists/{id}/cards', ['controller' => 'Cards', 'action' => 'add'])
            ->setPass(['id']);
        $builder->get('/cards/{id}', ['controller' => 'Cards', 'action' => 'view'])->setPass(['id']);
        $builder->patch('/cards/{id}', ['controller' => 'Cards', 'action' => 'edit'])->setPass(['id']);
        $builder->delete('/cards/{id}', ['controller' => 'Cards', 'action' => 'delete'])->setPass(['id']);
    });
};
