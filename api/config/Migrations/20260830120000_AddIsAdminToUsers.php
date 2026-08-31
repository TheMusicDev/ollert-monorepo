<?php
declare(strict_types=1);

use Migrations\BaseMigration;

class AddIsAdminToUsers extends BaseMigration
{
    /**
     * Change Method.
     *
     * @return void
     */
    public function change(): void
    {
        $table = $this->table('users');
        $table
            ->addColumn('is_admin', 'boolean', [
                'null' => false,
                'default' => false,
            ])
            ->update();
    }
}
