<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Evaluation;
use Illuminate\Http\Request;

class EvaluationController extends Controller
{
    public function index()
    {
        return Evaluation::with('customer')->paginate(30);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'customer_id' => 'required|exists:customers,id',
            'score' => 'nullable|integer|min:0|max:100',
            'last_contact_at' => 'nullable|date',
            'lifetime_value' => 'nullable|numeric',
            'notes' => 'nullable|string'
        ]);

        $ev = Evaluation::create($data);
        return response()->json($ev, 201);
    }
}
