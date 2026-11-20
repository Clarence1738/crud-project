<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->date('expected_arrival_date')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->dropColumn('expected_arrival_date');
        });
    }
};
