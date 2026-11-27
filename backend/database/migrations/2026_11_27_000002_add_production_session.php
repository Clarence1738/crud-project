<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Milk is recorded once or twice a day, so each measurement carries the milking session. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('livestock_measurements', function (Blueprint $t): void {
            $t->string('session', 20)->default('Whole day');
            $t->index(['farm_id', 'kind', 'measured_on']);
        });
    }

    public function down(): void
    {
        Schema::table('livestock_measurements', function (Blueprint $t): void {
            $t->dropIndex(['farm_id', 'kind', 'measured_on']);
            $t->dropColumn('session');
        });
    }
};
