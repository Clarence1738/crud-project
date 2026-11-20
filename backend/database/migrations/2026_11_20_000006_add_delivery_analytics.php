<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->date('promised_arrival_date')->nullable();
            $table->index(['user_id', 'status']);
        });
        Schema::table('transport_status_events', function (Blueprint $table): void {
            $table->index(['transport_id', 'status', 'id'], 'transport_events_status_lookup');
        });
    }

    public function down(): void
    {
        Schema::table('transport_status_events', function (Blueprint $table): void {
            $table->dropIndex('transport_events_status_lookup');
        });
        Schema::table('transports', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'status']);
            $table->dropColumn('promised_arrival_date');
        });
    }
};
