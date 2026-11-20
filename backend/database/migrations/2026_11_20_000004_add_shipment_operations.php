<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->string('reference', 80)->nullable();
            $table->string('goods_description', 500)->nullable();
            $table->unsignedInteger('quantity')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->index(['user_id', 'expected_arrival_date']);
        });
        Schema::create('transport_status_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignUuid('transport_id')->constrained()->cascadeOnDelete();
            $table->string('status', 20);
            $table->timestamp('changed_at');
        });
        Schema::table('documents', function (Blueprint $table): void {
            $table->foreignUuid('transport_id')->nullable()->constrained()->nullOnDelete();
            $table->index('transport_id');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table): void {
            $table->dropForeign(['transport_id']);
            $table->dropIndex(['transport_id']);
            $table->dropColumn('transport_id');
        });
        Schema::dropIfExists('transport_status_events');
        Schema::table('transports', function (Blueprint $table): void {
            $table->dropIndex(['user_id', 'expected_arrival_date']);
            $table->dropColumn(['reference', 'goods_description', 'quantity', 'delivered_at']);
        });
    }
};
