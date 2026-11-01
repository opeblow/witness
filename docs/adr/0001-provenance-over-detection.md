# 0001. Prove originals at capture instead of detecting fakes

Status: Accepted, 2026-11-01

## Context

Businesses that settle disputes with photos (returns, deliveries, rentals, insurance) increasingly receive AI-edited evidence. In Verisk's March 2026 survey, 99% of insurers had encountered manipulated or AI-altered documentation, and only 32% of claims professionals were very confident at spotting deepfakes. The usual response is detection: classifiers that estimate whether an image was generated or edited.

Detection has structural problems:

- it is an arms race that every new generation model resets;
- re-compression and light retouching defeat it;
- its output is a probability that neither side of a dispute is obliged to accept;
- the vendor holds the model and the logs, so the vendor is a trusted party.

## Decision

Witness proves provenance instead. A photo is fingerprinted and signed when it is taken and anchored on a public chain. Verification asks "is this the image that was sealed?", which has a definite answer and does not degrade as generators improve.

## Consequences

- Witness says nothing about images that were never sealed. They return "no record", which we present as distinct from "fake".
- Value depends on the capturing party adopting Witness at the moment of capture. This shapes the go-to-market: we start where one party controls the capture flow (a courier's delivery app, a rental check-out, an insurer's claim form).
- Witness does not prove a scene is real; a photographed screen is still a genuine photograph of a screen. This is documented in the threat model and stated on the landing page.
