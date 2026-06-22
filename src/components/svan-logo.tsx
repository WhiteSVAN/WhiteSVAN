/**
 * TrustSVAN brand lockup — swan mark + wordmark.
 *
 * The swan is the official vector (public/images/svan-logo.svg), inlined here so
 * it inherits text color via `currentColor` and stays crisp at any size.
 */
export function SvanLogo({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline gap-[0.04em] leading-none ${className ?? ""}`}
    >
      <span className="font-serif font-normal text-zinc-300">Trust</span>
      {/* the swan mark stands in for the "S" of SVAN */}
      <SwanMark className="h-[1.08em] w-auto shrink-0 self-center text-zinc-50 drop-shadow-[0_0_14px_rgba(255,255,255,0.18)]" />
      <span className="font-semibold text-zinc-50">VAN</span>
    </span>
  );
}

export function SwanMark({ className }: { className?: string }) {
  return (
    <svg viewBox="80 81 393 426" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        fillRule="evenodd"
        opacity="0.16"
        transform="translate(6 8)"
        d="M 80 308 L 87 341 L 100 366 L 124 392 L 150 408 L 189 419 L 283 417 L 318 426 L 295 406 L 266 392 L 234 384 L 187 377 L 142 362 L 110 342 Z M 80 165 L 83 205 L 94 240 L 115 276 L 143 305 L 198 338 L 300 369 L 327 384 L 352 408 L 370 449 L 369 479 L 359 507 L 394 464 L 405 428 L 403 395 L 382 355 L 353 329 L 326 314 L 203 278 L 159 256 L 111 215 Z M 340 81 L 310 92 L 286 115 L 272 146 L 269 179 L 277 214 L 292 241 L 395 335 L 421 381 L 425 410 L 417 449 L 399 482 L 372 507 L 417 484 L 453 447 L 469 413 L 473 371 L 463 334 L 443 304 L 341 223 L 315 190 L 309 172 L 315 140 L 331 126 L 355 124 L 371 134 L 382 164 L 407 185 L 425 218 L 443 229 L 434 198 L 439 145 L 426 116 L 392 88 Z M 415 148 L 417 148 L 420 151 L 420 152 L 421 153 L 421 156 L 422 157 L 422 163 L 421 164 L 419 164 L 416 161 L 416 160 L 415 159 L 415 157 L 414 156 L 414 149 Z"
      />
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M 80 308 L 87 341 L 100 366 L 124 392 L 150 408 L 189 419 L 283 417 L 318 426 L 295 406 L 266 392 L 234 384 L 187 377 L 142 362 L 110 342 Z M 80 165 L 83 205 L 94 240 L 115 276 L 143 305 L 198 338 L 300 369 L 327 384 L 352 408 L 370 449 L 369 479 L 359 507 L 394 464 L 405 428 L 403 395 L 382 355 L 353 329 L 326 314 L 203 278 L 159 256 L 111 215 Z M 340 81 L 310 92 L 286 115 L 272 146 L 269 179 L 277 214 L 292 241 L 395 335 L 421 381 L 425 410 L 417 449 L 399 482 L 372 507 L 417 484 L 453 447 L 469 413 L 473 371 L 463 334 L 443 304 L 341 223 L 315 190 L 309 172 L 315 140 L 331 126 L 355 124 L 371 134 L 382 164 L 407 185 L 425 218 L 443 229 L 434 198 L 439 145 L 426 116 L 392 88 Z M 415 148 L 417 148 L 420 151 L 420 152 L 421 153 L 421 156 L 422 157 L 422 163 L 421 164 L 419 164 L 416 161 L 416 160 L 415 159 L 415 157 L 414 156 L 414 149 Z"
      />
    </svg>
  );
}
