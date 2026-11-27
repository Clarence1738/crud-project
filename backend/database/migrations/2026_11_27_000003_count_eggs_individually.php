<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/** Eggs are counted one by one, so their unit is "eggs"; the unit now always follows the measure. */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('livestock_measurements')->where('kind', 'Eggs')->update(['unit' => 'eggs']);
        DB::table('livestock_measurements')->where('kind', 'Milk')->update(['unit' => 'litres']);
        DB::table('livestock_measurements')->whereIn('kind', ['Weight', 'Wool'])->update(['unit' => 'kg']);
    }

    public function down(): void
    {
        DB::table('livestock_measurements')->where('kind', 'Eggs')->update(['unit' => 'units']);
    }
};
