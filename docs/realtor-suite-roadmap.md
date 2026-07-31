# Hawk Guru Realtor Suite — Product roadmap

## Implemented foundation

- Buyer, Seller and Renter pipelines with D1 persistence.
- Lead score, automatic tags and a human-controlled stage move.
- AI Concierge tool contract for real-estate qualification.
- Multichannel inbox and escalation workflow.

## Next highest-value modules

1. **Seller valuation magnet** — capture address, ownership horizon, property type and appointment preference; create a Seller prospect with `lead-magnet` attribution.
2. **Buyer readiness quiz** — capture financing state, budget, desired areas and move timeline; assign a transparent readiness score.
3. **Open-house mode** — QR check-in, consent capture, instant property follow-up and a separate open-house source tag.
4. **Showing follow-up** — a human-approved sequence after a showing: feedback, objections, next listing or offer consultation.
5. **Property match alerts** — saved criteria, matching inventory feed and an approval queue before sending any alert.
6. **Listing launch checklist** — content, photos, disclosures, showing plan and campaign status for each Seller pipeline record.
7. **Referral radar** — identify past clients with positive conversations and ask for a referral only after human approval.

## Realtor Lead Analyst — OpenAI agent contract

The first internal agent should be one focused analyst, not a swarm of agents.

### Input

- Conversation transcript or lead-magnet answers.
- Existing prospect, pipeline stage and known tags.

### Structured output

```json
{
  "operation": "buyer | seller | renter | unknown",
  "score": 0,
  "tags": ["hot", "preapproved"],
  "missing_fields": ["budget"],
  "recommended_next_action": "...",
  "needs_human_review": true,
  "evidence": ["short source-grounded reasons"]
}
```

### Guardrails

- It never claims a property is available, quotes binding pricing or promises financing.
- It never sends a campaign, changes a closed stage or schedules an appointment without an explicit tool and approval rule.
- Every score, tag and recommendation stores evidence for the Realtor to review.
- Initial deployment uses the existing Vercel AI SDK inside the Worker. Adopt OpenAI Agents SDK only when this workflow needs durable handoffs or a separately operated analyst service.

## Readiness gate

Before enabling the analyst: configure `OPENAI_API_KEY`, add local eval cases for buyer/seller/renter plus missing-evidence cases, and have a Realtor approve the scoring rubric.
