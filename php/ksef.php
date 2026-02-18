<?php
/**
 * Placeholdery KSEF – w produkcji: certyfikat, API MF, struktura FA(2).
 */

function ksef_send(array $invoice): array {
    return ['success' => true, 'ksef_id' => 'KSEF-' . time()];
}

function ksef_fetch(string $dateFrom, string $dateTo): array {
    return ['success' => true, 'invoices' => []];
}
