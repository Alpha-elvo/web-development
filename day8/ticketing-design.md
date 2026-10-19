# TicketHub — Event Ticketing System Design

## 1. Requirements

### Context
TicketHub is a website where users discover events, view available seats, reserve seats, pay for tickets, and access purchased tickets. The main challenge is preventing double-booking during a popular concert sale.

### Functional requirements
- Users can register, sign in, and view events.
- Users can view seat availability for an event.
- Users can temporarily hold available seats.
- Users can pay for valid seat holds and receive confirmed tickets.
- Users can view their orders and purchased tickets.
- Expired unpaid holds release seats for other customers.
- Users receive clear responses when a seat is no longer available.

### Non-functional requirements
- **Speed:** event pages should normally load within 1 second under expected conditions; seat availability requests should usually complete within 300 ms, excluding external payment-provider delays.
- **Correctness:** a seat must never be sold to two customers.
- **Fairness:** apply a consistent queue or waiting-room policy during high-demand sales, with rate limits to discourage automated abuse. A queue alone does not guarantee a successful purchase.
- **Availability:** multiple application servers and health checks reduce the impact of an application-server failure.
- **Security:** authenticate users, authorize access to orders, validate inputs, protect payment workflows, and avoid storing raw card details.
- **Reliability:** payment callbacks must be idempotent so retries do not create duplicate orders or charges.
- **Scalability:** handle normal browsing and sudden bursts when popular events go on sale.

## 2. Traffic and storage estimates

### Given assumptions
- 2 million registered users.
- 50,000 visitors on a normal day.
- Each visitor views 10 pages.
- 5,000 tickets sold on a normal day.
- During a major sale, 200,000 people try to buy 20,000 seats in 10 minutes.

### Normal traffic
Daily page views = 50,000 × 10 = 500,000.

Average page views per second = 500,000 ÷ 86,400 ≈ 5.8.

Assume each page view generates two backend requests on average:
500,000 × 2 ÷ 86,400 ≈ 11.6 requests per second.

Ticket sales average:
5,000 ÷ 86,400 ≈ 0.058 tickets per second, or about 208 per hour averaged across the day. Actual sales will be uneven.

### Major-sale traffic
200,000 prospective buyers ÷ 600 seconds ≈ 333 buyer attempts per second.

Assume each buyer generates five requests during browsing and checkout:
200,000 × 5 ÷ 600 ≈ 1,667 requests per second.

This is an illustrative estimate, not a measured benchmark. Retries, polling, bots, and page assets can increase traffic further.

The sale has 20,000 seats for 200,000 prospective buyers: ten people competing per seat on average. At most 20,000 successful purchases are possible for this event.

Compared with the estimated normal API traffic of about 12 requests/second, the major sale could produce around 1,667 requests/second — roughly 144 times as much. The system must handle a sharp burst, especially for seat reads and conditional seat holds.

### Storage estimate
For a simple initial estimate, assume 2 million user records average 1 KB each, 100,000 events average 2 KB each, and 2 million seat records average 0.5 KB each. These records total approximately 4 GB before indexes, order history, replicas, logs, and backups. Actual storage depends on retention, ticket volume, and schema overhead. TicketHub should measure growth rather than treat this estimate as a guarantee.

## 3. API design

All endpoints use HTTPS. JSON is used for request and response bodies unless otherwise stated. Authenticated endpoints require a valid session or access token.

### 1. Browse events
`GET /api/events?search=music&page=1`

Returns `200 OK` with a paginated list of published events. Invalid query parameters return `400 Bad Request`.

### 2. View event seats
`GET /api/events/{eventId}/seats`

Returns `200 OK` with seat identifiers, prices, and availability. Availability is informational and can change immediately; the database decides whether a hold succeeds.

### 3. Hold a seat
`POST /api/events/{eventId}/holds`

Example request:
```json
{
  "seatIds": ["A-12"],
  "idempotencyKey": "hold-unique-client-key"
}
```

Returns `201 Created` with a hold/order identifier and expiry time if the seat is successfully held. Returns `409 Conflict` if the seat is unavailable. Holds expire after a short configured period, for example five minutes. Requests are authenticated and rate-limited.

### 4. Pay for an order
`POST /api/orders/{orderId}/payments`

Starts payment for the authenticated user's valid order. Returns `202 Accepted` when payment processing is pending, or an appropriate success response if the provider confirms synchronously. Invalid or expired orders return `409 Conflict`. Payment status is finalized using verified provider callbacks and idempotent processing.

### 5. View my orders
`GET /api/me/orders`

Returns `200 OK` with the authenticated user's orders. A user must not be able to access another user's orders.

### 6. View a ticket
`GET /api/me/tickets/{ticketId}`

Returns `200 OK` with ticket details only when the ticket belongs to the authenticated user; otherwise return `404 Not Found` or `403 Forbidden`, according to the API's privacy policy.

### Common errors
- `400 Bad Request`: malformed or invalid input.
- `401 Unauthorized`: authentication is required.
- `403 Forbidden`: the user lacks permission.
- `404 Not Found`: event, order, or ticket does not exist or is not accessible.
- `409 Conflict`: seat unavailable, hold expired, or order in an incompatible state.
- `429 Too Many Requests`: rate limit exceeded.
- `500 Internal Server Error`: unexpected server failure.

## 4. Data model

Use a relational database such as PostgreSQL because transactions, unique constraints, and foreign keys are central to correct booking.

### users
- `id`: primary key.
- `email`: required and unique.
- `created_at`: timestamp.

### events
- `id`: primary key.
- `title`: required.
- `venue`: required.
- `starts_at`: timestamp.
- `status`: for example, draft, published, or cancelled.

### seats
- `id`: primary key.
- `event_id`: foreign key referencing `events.id`.
- `seat_label`: required seat identifier, such as A-12.
- `price`: required non-negative monetary amount.
- `status`: AVAILABLE, HELD, or SOLD.
- `held_by_user_id`: nullable foreign key referencing `users.id`.
- `hold_expires_at`: nullable timestamp.
- `order_id`: nullable reference to the order that ultimately owns the seat.

Constraint: `UNIQUE(event_id, seat_label)` ensures a seat label appears only once per event.

### orders
- `id`: primary key.
- `user_id`: foreign key referencing `users.id`.
- `status`: PENDING, PAYMENT_PENDING, PAID, EXPIRED, or CANCELLED.
- `idempotency_key`: unique key scoped to the relevant user/operation.
- `created_at`: timestamp.
- `expires_at`: timestamp for unpaid holds.

### order_items
- `id`: primary key.
- `order_id`: foreign key referencing `orders.id`.
- `seat_id`: foreign key referencing `seats.id`.
- `price_at_purchase`: required price snapshot.
- Constraint: `UNIQUE(seat_id)` prevents the same seat from appearing in multiple order items.

### Relationships
- One user can have many orders.
- One event can have many seats.
- One order can contain multiple order items.
- Each order item references one seat.
- A seat belongs to one event and can be sold at most once.

The `order_items` uniqueness constraint is a final safeguard, not a replacement for transactional seat allocation. The database schema and application transaction must be implemented consistently.

## 5. High-level architecture

```text
                    Customers
                        |
                 DNS / CDN / WAF
                        |
             Waiting room / rate limits
                        |
                  Load balancer
                   /          \
             App server 1   App server 2
                   \          /
                 Stateless API
                 /     |      \
             Redis   PostgreSQL  Payment provider
             cache   primary          |
                       |         Verified webhook
                 Read replicas          |
                       |                 |
                       +----> Order/payment worker
                              |
                       Email / ticket delivery
```

### Component responsibilities
- **DNS/CDN/WAF:** deliver cacheable static assets near users and filter malicious traffic. Dynamic seat availability must not be cached as if it were authoritative.
- **Waiting room and rate limits:** smooth the arrival burst, enforce consistent access rules, and limit abusive clients. Queue policy must be transparent and should not promise that everyone gets a seat.
- **Load balancer:** distributes requests across healthy application servers.
- **Stateless application servers:** handle API requests without relying on local session state, allowing servers to be added or replaced easily.
- **Redis cache:** accelerates public event details and other safe, frequently read data. The database remains authoritative for seat ownership.
- **PostgreSQL primary:** handles transactions, seat holds, order state, and uniqueness constraints. This is the source of truth for booking correctness.
- **Read replicas:** serve suitable read-heavy queries, such as historical event listings. Replication lag means they must not authorize a seat purchase.
- **Payment provider and worker:** process payment securely and retry background tasks safely. Webhooks must be verified and processed idempotently.
- **Monitoring and alerting:** track latency, request rate, error rate, queue length, database connections, lock waits, failed payments, and expired holds.

### Preventing two people from buying the same seat
The frontend's availability display is not a lock. Two customers may both see a seat as available, so the primary database must make the final decision.

1. Begin a database transaction.
2. Attempt a conditional update on the requested seat, such as changing `AVAILABLE` to `HELD` only if its current state is still `AVAILABLE`, or if an existing hold has safely expired.
3. Check the number of affected rows. If it is not exactly one for that seat, roll back and return `409 Conflict`.
4. Create the order and its order item in the same transaction, protected by foreign keys and `UNIQUE(seat_id)`.
5. Commit the transaction. Only then report a successful hold.

Concurrent updates to the same row are serialized by the database. Only one transaction can successfully claim the seat; the other observes that the condition no longer matches. The unique constraint supplies an additional safeguard.

When payment is confirmed, use an idempotent transaction to mark the order PAID and the seat SOLD. If payment fails or the hold expires, release the seat safely. Payment-provider calls should not be performed while holding a long-running database transaction; use a reliable payment state machine and verified callbacks to handle failures and retries.

### How the system survives a major sale
- Add application instances behind the load balancer as traffic grows.
- Use a waiting room to regulate sudden demand instead of allowing every request to hit the database at once.
- Cache public event information, while sending seat holds to the authoritative primary database.
- Limit database connection pools and monitor lock contention.
- Use queues for non-critical tasks such as email delivery.
- Maintain backups, health checks, and a tested database recovery/failover plan.
- Load-test with realistic concurrency before major events. Read replicas improve eligible reads, but do not remove the need for correct writes to the primary.

## 6. Trade-offs and alternatives

### Trade-off 1: Strong consistency versus maximum availability
Seat holds go through the authoritative primary database to prevent double-booking. This can make booking slower or temporarily unavailable during a database outage, but accepting conflicting writes would risk selling the same seat twice. Correctness takes priority for seat allocation.

### Trade-off 2: Waiting room versus immediate access
A waiting room protects the application and database from a sudden burst and can apply a consistent queue policy. However, users wait longer, and a queue does not create more seats. Fairness requires transparent rules, abuse controls, and monitoring.

### Trade-off 3: Cache speed versus stale availability
Caching public event details reduces database load. Caching seat availability can show stale information, so it is treated as a hint only. The transactional database decides whether a hold succeeds.

### Trade-off 4: Read replicas versus simpler database operations
Read replicas improve read capacity but add operational complexity and replication lag. Booking decisions must not rely on potentially stale replicas.

## Risks and open questions
- The estimates are assumptions; realistic load testing is required.
- Payment-provider outages and delayed callbacks need reconciliation and safe retries.
- Hold expiry and payment confirmation can race, so state transitions must be transactional.
- Queue fairness, accessibility, bot detection, cancellation, refunds, and event-specific seating rules need clear product policies.
- Database failover, backups, and recovery objectives must be tested before a high-demand launch.

## Conclusion
TicketHub can scale browsing with caching, stateless app servers, and read replicas, while preserving booking correctness through atomic conditional updates, transactions, and uniqueness constraints. Each additional component addresses a specific bottleneck or failure mode; none removes the need to measure the real workload and test the system under concurrency.
