<?php

namespace App\Policies;

use App\Models\Transport;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class TransportPolicy
{
    public function view(User $user, Transport $transport): Response
    {
        return $user->id === $transport->user_id ? Response::allow() : Response::denyAsNotFound();
    }

    public function update(User $user, Transport $transport): Response
    {
        return $this->view($user, $transport);
    }

    public function delete(User $user, Transport $transport): Response
    {
        return $this->view($user, $transport);
    }
}
