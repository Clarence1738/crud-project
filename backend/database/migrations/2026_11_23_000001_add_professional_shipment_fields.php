<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->string('driver_name', 120)->nullable();
            $table->string('driver_phone', 30)->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('archived_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->dropIndex(['archived_at']);
            $table->dropColumn(['driver_name', 'driver_phone', 'notes', 'archived_at']);
        });
    }
};
