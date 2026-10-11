# ADR-001: Use RESTful APIs for Internal Service Communication

**Status:** Superseded for the microservice architecture by [Modular Monolith](./0001-monolith-vs-microservices.md). Status clarified against the implementation on 11 October 2026.

**Current applicability:** The historical decision below describes a microservice proposal. The implemented system uses JSON over HTTP between the React browser client and Express `/api`, while server modules share one process and communicate through TypeScript calls. It does not implement internal microservice discovery, a service load balancer, or the OpenAPI contract promised below. See the [current C4 view](../c4-container.md) and [technology stack](../tech_stack.md). The original rationale is retained as history, not a claim about deployed features.

**Context:**
Our system is being designed with a Microservices architecture. We need a standardized, well-understood mechanism for synchronous communication between services. The development team has experience with both RESTful APIs (using HTTP/JSON) and gRPC.

**Decision:**
We will use RESTful APIs with JSON payloads as the primary mechanism for synchronous, request-response communication between our internal microservices. All services must expose their capabilities through a well-defined OpenAPI (Swagger) specification.

**Consequences:**
*   **Positive:**
    *   Leverages existing team skills in HTTP and JSON, reducing the learning curve.
    *   Easy to debug and test using common tools like Postman, Insomnia, or even a web browser.
    *   A wide range of libraries and frameworks support REST, making implementation straightforward.
    *   The OpenAPI specification will serve as a form of "enforceable contract" between services.
*   **Negative:**
    *   REST over HTTP/JSON is more verbose and may have slightly higher latency compared to binary protocols like gRPC.
    *   We lose the benefits of strong typing across service boundaries that gRPC provides.
    *   We will need to implement our own mechanisms for features like service discovery and client-side load balancing.

