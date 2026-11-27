<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/** Ends the session of an account that a System Administrator has suspended. */
class ActiveAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->user()?->suspended_at !== null) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            abort(401, 'This account has been suspended.');
        }

        return $next($request);
    }
}
