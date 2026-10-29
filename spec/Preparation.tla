-------------------------- MODULE Preparation --------------------------
EXTENDS Naturals, FiniteSets
VARIABLES revision, checked, published, canceled, rooms
vars == <<revision, checked, published, canceled, rooms>>
Init == /\ revision = 1 /\ checked = {} /\ published = 0
        /\ canceled = FALSE /\ rooms = {}
Validate(r) == /\ r \in 1..2 /\ r <= revision /\ ~canceled
               /\ checked' = checked \cup {r}
               /\ UNCHANGED <<revision, published, canceled, rooms>>
Revise == /\ revision = 1 /\ ~canceled /\ rooms = {}
          /\ revision' = 2 /\ published' = 0
          /\ UNCHANGED <<checked, canceled, rooms>>
Publish == /\ revision \in checked /\ ~canceled
           /\ published' = revision
           /\ UNCHANGED <<revision, checked, canceled, rooms>>
Start == /\ published = revision /\ published # 0 /\ ~canceled
         /\ rooms' = rooms \cup {published}
         /\ UNCHANGED <<revision, checked, published, canceled>>
Cancel == /\ ~canceled /\ canceled' = TRUE
          /\ UNCHANGED <<revision, checked, published, rooms>>
Next == (\E r \in 1..2 : Validate(r)) \/ Revise \/ Publish \/ Start \/ Cancel
Spec == Init /\ [][Next]_vars
TypeOK == /\ revision \in 1..2 /\ checked \subseteq 1..2
          /\ published \in 0..2 /\ canceled \in BOOLEAN /\ rooms \subseteq 1..2
CurrentPublication == published # 0 => published = revision
ValidatedPublication == published # 0 => published \in checked
RoomsUseValidatedVersion == rooms \subseteq checked
NoLateStart == [][canceled => UNCHANGED rooms]_vars
=============================================================================
