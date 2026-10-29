--------------------------- MODULE Classroom ---------------------------
EXTENDS Naturals, FiniteSets
CONSTANTS Students, Requests
VARIABLES phase, seen, accepted, hints, snapshot, delivery
vars == <<phase, seen, accepted, hints, snapshot, delivery>>
Init == /\ phase = "live"
        /\ seen = {}
        /\ accepted = [r \in Requests |-> 0]
        /\ hints = [s \in Students |-> 0]
        /\ snapshot = {}
        /\ delivery = "draft"
Submit(s, r) == /\ phase = "live"
                /\ r \notin seen
                /\ seen' = seen \cup {r}
                /\ accepted' = [accepted EXCEPT ![r] = @ + 1]
                /\ hints' = [hints EXCEPT ![s] = IF @ < 3 THEN @ + 1 ELSE 3]
                /\ UNCHANGED <<phase, snapshot, delivery>>
Retry(r) == /\ r \in seen /\ UNCHANGED vars
Close == /\ phase = "live"
         /\ phase' = "closed"
         /\ snapshot' = seen
         /\ UNCHANGED <<seen, accepted, hints, delivery>>
Reserve == /\ phase = "closed" /\ delivery = "draft"
           /\ delivery' = "reserved"
           /\ UNCHANGED <<phase, seen, accepted, hints, snapshot>>
Complete == /\ delivery = "reserved"
            /\ delivery' \in {"sent", "unknown"}
            /\ UNCHANGED <<phase, seen, accepted, hints, snapshot>>
Next == (\E s \in Students, r \in Requests : Submit(s,r))
        \/ (\E r \in Requests : Retry(r)) \/ Close \/ Reserve \/ Complete
Spec == Init /\ [][Next]_vars
TypeOK == /\ phase \in {"live", "closed"}
          /\ seen \subseteq Requests
          /\ accepted \in [Requests -> 0..1]
          /\ hints \in [Students -> 0..3]
          /\ snapshot \subseteq Requests
          /\ delivery \in {"draft", "reserved", "sent", "unknown"}
ExactlyOnce == \A r \in Requests : accepted[r] = IF r \in seen THEN 1 ELSE 0
FrozenReport == phase = "closed" => snapshot = seen
ClosedBeforeDelivery == delivery # "draft" => phase = "closed"
NoLateWrites == [][phase = "closed" => UNCHANGED seen]_vars
=============================================================================
