--------------------------- MODULE Coverage ---------------------------
EXTENDS Naturals, FiniteSets
CONSTANTS Substitutes, Periods
VARIABLES assigned, accepted, canceled
vars == <<assigned, accepted, canceled>>
Init == /\ assigned = {} /\ accepted = {} /\ canceled = FALSE
Accept(s) == /\ ~canceled /\ assigned = {}
             /\ assigned' = {<<p,s>> : p \in Periods}
             /\ accepted' = {s}
             /\ UNCHANGED canceled
Retry(s) == /\ s \in accepted /\ UNCHANGED vars
Cancel == /\ ~canceled /\ canceled' = TRUE
          /\ assigned' = {} /\ accepted' = {}
Next == (\E s \in Substitutes : Accept(s) \/ Retry(s)) \/ Cancel
Spec == Init /\ [][Next]_vars
TypeOK == /\ assigned \subseteq (Periods \X Substitutes)
          /\ accepted \subseteq Substitutes /\ canceled \in BOOLEAN
OneSubPerPeriod == \A p \in Periods : Cardinality({s \in Substitutes : <<p,s>> \in assigned}) <= 1
OneAcceptance == Cardinality(accepted) <= 1
CanceledHasNoAssignment == canceled => assigned = {}
=============================================================================
