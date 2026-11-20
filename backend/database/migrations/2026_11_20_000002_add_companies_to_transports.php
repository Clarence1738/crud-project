<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->string('sender_company', 120)->nullable();
            $table->string('recipient_company', 120)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('transports', function (Blueprint $table): void {
            $table->dropColumn(['sender_company', 'recipient_company']);
        });
    }
};
