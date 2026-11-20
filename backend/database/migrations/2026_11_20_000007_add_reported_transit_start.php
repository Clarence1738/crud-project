<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->timestamp('reported_transit_started_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->dropColumn('reported_transit_started_at');
        });
    }
};
