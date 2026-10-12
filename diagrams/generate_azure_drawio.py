"""Generate diagrams/azure-architecture.drawio for ExchangeFlow (v0.2, 5 pages)."""
from xml.sax.saxutils import escape
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "azure-architecture.drawio")
LIB = "img/lib/azure2/"
AZ = "#0078D4"


def attr(s):
    return escape(s, {'"': "&quot;"})


class Page:
    def __init__(self, name, pid):
        self.name, self.pid, self.cells, self.ids, self.n = name, pid, [], set(), 0

    def _id(self, p):
        self.n += 1
        return f"{self.pid}-{p}{self.n}"

    def _vertex(self, cid, label, style, x, y, w, h):
        self.cells.append(f'<mxCell id="{cid}" value="{attr(label)}" style="{style}" vertex="1" parent="1">'
                          f'<mxGeometry x="{x}" y="{y}" width="{w}" height="{h}" as="geometry"/></mxCell>')

    def group(self, label, x, y, w, h, stroke="#666666", fill="none", dashed=1):
        style = (f"rounded=1;arcSize=3;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};dashed={dashed};"
                 f"verticalAlign=top;align=left;spacingLeft=8;spacingTop=4;fontStyle=1;fontSize=12;fontColor={stroke};")
        self._vertex(self._id("g"), label, style, x, y, w, h)

    def icon(self, label, img, x, y, size=50):
        cid = self._id("i")
        self.ids.add(cid)
        style = (f"image;aspect=fixed;html=1;points=[];align=center;fontSize=11;image={LIB}{img};"
                 f"labelBackgroundColor=none;verticalLabelPosition=bottom;verticalAlign=top;")
        self._vertex(cid, label, style, x, y, size, size)
        return cid

    def note(self, text, x, y, w, h, fill="#FFF2CC", stroke="#D6B656"):
        style = (f"shape=note;size=12;whiteSpace=wrap;html=1;fillColor={fill};strokeColor={stroke};"
                 f"align=left;verticalAlign=top;spacingLeft=6;spacingTop=2;fontSize=11;")
        self._vertex(self._id("n"), text, style, x, y, w, h)

    def frame(self, label, x, y, w, h):
        style = ("shape=umlFrame;whiteSpace=wrap;html=1;width=200;height=24;boundedLbl=1;verticalAlign=top;"
                 "align=left;spacingLeft=6;fontSize=11;fillColor=none;strokeColor=#B85450;fontColor=#B85450;dashed=1;")
        self._vertex(self._id("f"), label, style, x, y, w, h)

    def title(self, text):
        self._vertex(self._id("t"), text, "text;html=1;fontSize=20;fontStyle=1;align=left;verticalAlign=middle;",
                     20, 0, 1500, 40)

    def edge(self, s, t, label="", dashed=False, color="#333333"):
        assert s in self.ids and t in self.ids, (s, t)
        style = (f"edgeStyle=none;html=1;endArrow=block;endFill=1;strokeColor={color};fontSize=10;"
                 f"labelBackgroundColor=#FFFFFF;dashed={1 if dashed else 0};")
        self.cells.append(f'<mxCell id="{self._id("e")}" value="{attr(label)}" style="{style}" edge="1" parent="1" '
                          f'source="{s}" target="{t}"><mxGeometry relative="1" as="geometry"/></mxCell>')

    def lifeline(self, label, x, h, w=130):
        style = ("shape=umlLifeline;perimeter=lifelinePerimeter;whiteSpace=wrap;html=1;container=0;collapsible=0;"
                 "recursiveResize=0;outlineConnect=0;size=50;fontSize=11;fillColor=#DAE8FC;strokeColor=#6C8EBF;")
        self._vertex(self._id("l"), label, style, x, 60, w, h)
        return x + w / 2

    def msg(self, x1, x2, y, label, ret=False):
        style = ("html=1;verticalAlign=bottom;fontSize=10;labelBackgroundColor=#FFFFFF;"
                 + ("dashed=1;endArrow=open;endFill=0;strokeColor=#666666;" if ret
                    else "endArrow=block;endFill=1;strokeColor=#0078D4;"))
        self.cells.append(f'<mxCell id="{self._id("m")}" value="{attr(label)}" style="{style}" edge="1" parent="1">'
                          f'<mxGeometry relative="1" as="geometry"><mxPoint x="{x1}" y="{y}" as="sourcePoint"/>'
                          f'<mxPoint x="{x2}" y="{y}" as="targetPoint"/></mxGeometry></mxCell>')

    def xml(self):
        return (f'<diagram id="{self.pid}" name="{attr(self.name)}"><mxGraphModel dx="1400" dy="900" grid="1" '
                f'gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" '
                f'pageWidth="1654" pageHeight="1169" math="0" shadow="0"><root><mxCell id="0"/>'
                f'<mxCell id="1" parent="0"/>{"".join(self.cells)}</root></mxGraphModel></diagram>')


class Seq:
    """Helper to lay out a sequence diagram with step numbering."""

    def __init__(self, page, start_y=150, step=36):
        self.p, self.y, self.step, self.k = page, start_y, step, 0

    def m(self, a, b, label, ret=False):
        self.k += 1
        self.p.msg(a, b, self.y, f"{self.k}. {label}", ret)
        self.y += self.step

    def note(self, x, text, w=300, h=34):
        self.p.note(text, x, self.y - 14, w, h, fill="#F5F5F5", stroke="#999999")
        self.y += h + 8

    def alt(self, x, w, label, body):
        top = self.y - 18
        self.y += 18
        body()
        self.p.frame(label, x, top, w, self.y - top - 6)
        self.y += 10


def common_left(p):
    users = p.icon("Staff, reviewers, policy roles<br>(desktop browser)", "identity/Users.svg", 60, 330)
    entra = p.icon("Microsoft Entra ID<br>OIDC, Conditional Access,<br>MFA + step-up", "identity/Azure_Active_Directory.svg", 60, 560)
    fd = p.icon("Front Door Premium<br>+ WAF, headers, CSP", "networking/Front_Doors.svg", 250, 330)
    p.edge(users, fd, "HTTPS (cookie session)")
    p.edge(users, entra, "sign-in redirect", dashed=True)
    return users, entra, fd


def data_tier(p, x0, y0):
    pg = p.icon("PostgreSQL Flexible Server<br>GP, private endpoint,<br>PgBouncer, ZR HA (prod)",
                "databases/Azure_Database_PostgreSQL_Server.svg", x0, y0)
    kv = p.icon("Key Vault Premium<br>RBAC; non-exportable<br>anchor key; HMAC key", "security/Key_Vaults.svg", x0 + 170, y0)
    pe = p.icon("Private endpoints<br>+ private DNS zones", "networking/Private_Endpoint.svg", x0, y0 + 190)
    nat = p.icon("NAT Gateway<br>egress allow-list", "networking/NAT.svg", x0 + 170, y0 + 190)
    return pg, kv, pe, nat


def audit_and_ops(p, x, pg, writer):
    p.group("Audit subscription (separate admins)", x, 60, 230, 380, stroke="#B85450", fill="#FBEDEC")
    blob = p.icon("Immutable Blob<br>signed anchors (5 min)<br>GRS to Canada East", "storage/Storage_Accounts.svg", x + 90, 110)
    sec = p.icon("Security workspace<br>(pgaudit, Entra, Key Vault,<br>app security events)", "analytics/Log_Analytics_Workspaces.svg", x + 90, 270)
    p.edge(writer, blob, "signed anchor")
    p.edge(pg, sec, "pgaudit / diagnostics", dashed=True, color="#B85450")
    p.group("Platform", x, 460, 230, 380, stroke="#666666")
    ai = p.icon("App Insights +<br>engineering workspace<br>(telemetry allow-list)", "devops/Application_Insights.svg", x + 90, 500)
    p.icon("Defender for Cloud", "security/Azure_Defender.svg", x + 30, 650)
    p.icon("Azure Policy<br>baseline initiative", "management_governance/Policy.svg", x + 150, 650)
    p.icon("Cost Management<br>budgets", "management_governance/Cost_Management_and_Billing.svg", x + 90, 760)
    return blob, ai


def dr(p, x, pg):
    p.group("Canada East — minimum DR", x, 160, 200, 200, stroke="#82B366", fill="#F3F9EE")
    geo = p.icon("Geo-redundant<br>DB backups", "databases/Azure_Database_PostgreSQL_Server.svg", x + 75, 220)
    p.edge(pg, geo, "geo backup", dashed=True, color="#82B366")


# ---------- Page 1: Option 2 ----------
p1 = Page("Option 2 - Container Apps (recommended)", "opt2")
p1.title("ExchangeFlow on Azure — Option 2: Azure Container Apps (recommended, v0.2)")
users, entra, fd = common_left(p1)
p1.group("Production subscription — Canada Central", 380, 60, 820, 790, fill="#FAFAFA")
p1.group("Virtual network", 400, 100, 780, 730, stroke=AZ)
p1.group("Container Apps environment — workload profiles, internal, zone-redundant", 420, 140, 330, 560, stroke=AZ, fill="#E8F1FB", dashed=0)
api = p1.icon("api — min 3 replicas<br>SPA + BFF session + REST API<br>workflow + policy engine (in-process)", "other/Container_App_Environments.svg", 560, 180)
wrk = p1.icon("worker — always on (min 1–2)<br>pg-boss, outbox relay,<br>in-app inbox", "other/Worker_Container_App.svg", 560, 360)
job = p1.icon("jobs: migrate (manual), anchor (5 min),<br>expiry, sampling, nightly self-checks,<br>rule metrics", "general/Scheduler.svg", 560, 540)
pg, kv, pe, nat = data_tier(p1, 830, 180)
acr = p1.icon("Container Registry Premium<br>signed images, digest deploys", "containers/Container_Registries.svg", 830, 600)
blob, ai = audit_and_ops(p1, 1230, pg, job)
dr(p1, 1490, pg)
p1.edge(fd, api, "private link (X-Azure-FDID)")
p1.edge(api, pg, "one transaction:<br>request, decision, audit, outbox")
p1.edge(wrk, pg, "relay outbox → inbox")
p1.edge(job, pg, "workflow commands, reads")
p1.edge(job, kv, "sign anchor (id-job-anchor)")
p1.edge(api, kv, "HMAC key only", dashed=True)
p1.edge(acr, job, "AcrPull by digest", dashed=True)
p1.edge(api, ai, "telemetry", dashed=True)
p1.edge(api, entra, "OIDC code exchange (confidential client)", dashed=True)
p1.note("<b>v0.2 changes</b><br>• No Service Bus, Web PubSub or Static Web Apps<br>"
        "• Browser polls the in-app inbox (15–30 s)<br>• Roles + branch from the app DB; Entra authenticates only<br>"
        "• Worker never scales to zero; api ≥ 3 replicas in prod<br>• Anchors in a separate subscription",
        40, 870, 420, 110)

# ---------- Page 2: Option 1 ----------
p2 = Page("Option 1 - Reserved VMs (IaaS)", "opt1")
p2.title("ExchangeFlow on Azure — Option 1: Virtual machines on reserved instances")
users, entra, fd = common_left(p2)
p2.group("Production subscription — Canada Central", 380, 60, 820, 790, fill="#FAFAFA")
p2.group("Virtual network", 400, 100, 780, 730, stroke=AZ)
pls = p2.icon("Private Link Service", "networking/Private_Link_Service.svg", 430, 250)
ilb = p2.icon("Internal Load Balancer", "networking/Load_Balancers.svg", 430, 400)
p2.group("VM Scale Set (Flexible) — 3 zones, reserved 1 or 3 years", 560, 140, 220, 560, stroke=AZ, fill="#E8F1FB", dashed=0)
vms = [p2.icon(f"Zone {i + 1}: Linux VM<br>container: api + worker{' + jobs' if i == 2 else ''}",
               "compute/Virtual_Machine.svg", 645, 180 + i * 170) for i in range(3)]
bas = p2.icon("Azure Bastion<br>(no public SSH)", "networking/Bastions.svg", 430, 600)
upd = p2.icon("Update Manager<br>(OS patching)", "other/Update_Center.svg", 645, 720)
pg, kv, pe, nat = data_tier(p2, 830, 180)
res = p2.icon("Reserved VM Instances /<br>savings plan", "other/Reserved_Capacity.svg", 830, 600)
blob, ai = audit_and_ops(p2, 1230, pg, vms[2])
dr(p2, 1490, pg)
p2.edge(fd, pls, "private link")
p2.edge(pls, ilb, "")
for v in vms:
    p2.edge(ilb, v, "")
p2.edge(vms[0], pg, "SQL (managed identity)")
p2.edge(vms[1], kv, "keys", dashed=True)
p2.edge(bas, vms[2], "admin", dashed=True)
p2.edge(upd, vms[2], "patch", dashed=True)
p2.note("<b>Trade-off</b><br>• Lowest compute price for steady load once reserved<br>"
        "• Team owns patching, hardening, scaling, blue-green<br>• Paid 24/7 · ops ≈ 0.4–0.6 FTE",
        40, 870, 400, 90)

# ---------- Page 3: Option 3 ----------
p3 = Page("Option 3 - Serverless (Functions)", "opt3")
p3.title("ExchangeFlow on Azure — Option 3: Serverless (Functions, no Durable)")
users, entra, fd = common_left(p3)
p3.group("Production subscription — Canada Central", 380, 60, 820, 790, fill="#FAFAFA")
p3.group("Virtual network (VNet integration)", 400, 100, 780, 730, stroke=AZ)
apim = p3.icon("API Management<br>pass-through, rate limit<br>(no validate-jwt for sessions)", "integration/API_Management_Services.svg", 430, 330)
p3.group("Function app — Flex Consumption (always-ready) or Premium", 540, 130, 260, 680, stroke=AZ, fill="#E8F1FB", dashed=0)
f_sub = p3.icon("HTTP: submit<br>(engine in-process)", "compute/Function_Apps.svg", 645, 170)
f_dec = p3.icon("HTTP: reviewer decision", "compute/Function_Apps.svg", 645, 280)
f_adm = p3.icon("HTTP: policy admin", "compute/Function_Apps.svg", 645, 380)
f_rl = p3.icon("Timer: outbox relay loop,<br>expiry and lapse sweeps", "general/Scheduler.svg", 645, 500)
f_tm = p3.icon("Timer: anchor, sampling,<br>self-checks", "general/Scheduler.svg", 645, 680)
pg, kv, pe, nat = data_tier(p3, 860, 180)
blob, ai = audit_and_ops(p3, 1230, pg, f_tm)
dr(p3, 1490, pg)
p3.edge(fd, apim, "private link")
for f in (f_sub, f_dec, f_adm):
    p3.edge(apim, f, "")
p3.edge(f_rl, pg, "SQL — SKIP LOCKED, row lease")
p3.edge(f_sub, pg, "one transaction (source of truth)")
p3.note("<b>Cautions</b><br>• Cold starts vs 2 s p95 unless always-ready<br>"
        "• No Durable: PostgreSQL is the only state store (ADR-024)<br>• Flex Consumption: no slots, rolling updates",
        40, 870, 400, 90)

# ---------- Page 4: Call flow ----------
p4 = Page("Call flow - sign-in, submit, notify, decide", "flow")
p4.title("ExchangeFlow (Option 2) — Call flow v0.2: sign-in, submit, notify, decide")
names = ["Staff browser", "Microsoft Entra ID", "Front Door + WAF", "api<br>(BFF + workflow)",
         "Policy engine<br>(in-process, pure)", "PostgreSQL", "worker<br>(outbox relay)", "Reviewer browser"]
X = [p4.lifeline(n, 20 + i * 175, 1500) for i, n in enumerate(names)]
STAFF, ENTRA, FD, API, ENG, PG, WRK, REV = X
s = Seq(p4)
s.note(20, "<b>Sign-in (BFF)</b> — no tokens in the browser", w=300, h=24)
s.m(STAFF, FD, "GET / (no session)")
s.m(FD, API, "forward over private link")
s.m(API, STAFF, "302 to Entra (auth code + PKCE)", ret=True)
s.m(STAFF, ENTRA, "sign in; MFA by Conditional Access")
s.m(ENTRA, STAFF, "redirect with code", ret=True)
s.m(STAFF, API, "GET /callback?code (via Front Door)")
s.m(API, ENTRA, "exchange code (confidential client, Key Vault cert)")
s.m(ENTRA, API, "tokens (identity only)", ret=True)
s.m(API, PG, "create session; load roles + branch from app DB")
s.m(API, STAFF, "Set-Cookie __Host- session (HttpOnly, SameSite)", ret=True)
s.note(20, "<b>Submit</b>", w=120, h=24)
s.m(STAFF, FD, "POST /requests (cookie, CSRF, Idempotency-Key)")
s.m(FD, API, "WAF; forward; X-Azure-FDID checked")
s.note(API - 150, "authorize; validate body (strict schema);<br>build context server-side; asOf = clock", w=300, h=40)
s.m(API, PG, "look up (submitter, idempotency key)")
s.alt(STAFF - 60, API - STAFF + 220, "alt [key already used]",
      lambda: s.m(API, STAFF, "200 stored response, or 422 IDEMPOTENCY_MISMATCH", ret=True))
s.m(API, PG, "read policy pointer + control row (never cached)")
s.m(API, ENG, "evaluate(context, policy[cached by id], control, asOf)")
s.m(ENG, API, "Decision (+ shadowResults, hashes, engineVersion)", ret=True)
s.m(API, PG, "BEGIN; SELECT control_revision FOR SHARE")
s.alt(API - 60, PG - API + 120, "alt [control revision changed]",
      lambda: s.m(API, PG, "ROLLBACK; re-evaluate once, else HUMAN_REVIEW / ENGINE_PAUSED"))
s.m(API, PG, "INSERT request+revision, decision_record (full input), audit, outbox; counters; COMMIT")
s.m(API, STAFF, "201 (id, status, version, outcome, generic reason) via Front Door", ret=True)
s.note(20, "<b>Notify</b> — inbox polling, no WebSocket service", w=330, h=24)
s.m(WRK, PG, "relay outbox (FOR UPDATE SKIP LOCKED) → inbox rows; mark relayed")
s.m(REV, API, "GET /queue, /inbox every 15–30 s (via Front Door)")
s.m(API, REV, "queue + notifications (IDs and codes only)", ret=True)
s.note(20, "<b>Decide</b>", w=120, h=24)
s.m(REV, API, "POST /requests/{id}/decision (cookie, CSRF, expectedVersion, step-up if required)")
s.note(API - 150, "authorize; branch scope; reviewer ≠ submitter;<br>transition table; reason required", w=300, h=40)
s.m(API, PG, "UPDATE ... WHERE version = n; review_decision UNIQUE(cycle); audit; outbox; COMMIT")
s.m(API, REV, "200, or 409 STALE_REQUEST with current state", ret=True)
p4.note("<b>Invariants</b><br>• No automated outcome commits after a pause (locked revision check)<br>"
        "• One request per idempotency key · one final decision per cycle<br>"
        "• Every decision stores its full input for replay<br>• Notification failure never undoes a decision",
        20, s.y + 20, 520, 90)

# ---------- Page 5: Privileged flows ----------
p5 = Page("Privileged flows - rules, pause, anchoring", "priv")
p5.title("ExchangeFlow — Privileged flows: rule approval, two-person activation, pause, audit anchoring")
names = ["Policy author", "Policy approver", "Policy owner /<br>compliance / manager", "api",
         "PostgreSQL", "anchor job", "Key Vault", "Immutable Blob<br>(audit subscription)", "SIEM / security<br>workspace"]
X = [p5.lifeline(n, 20 + i * 160, 1250, w=130) for i, n in enumerate(names)]
AUTH, APPR, OWN, API, PG, ANC, KV, BLOB, SIEM = X
s = Seq(p5)
s.note(20, "<b>Draft and approve</b>", w=170, h=24)
s.m(AUTH, API, "POST rule version (draft; schema v1)")
s.m(API, PG, "insert immutable draft + content hash; audit")
s.m(APPR, API, "approve (step-up MFA; content hash)")
s.note(API - 150, "approver ≠ author; role conflicts checked;<br>regulated class derived by the system", w=300, h=40)
s.m(API, PG, "approval record bound to hash; audit")
s.m(API, SIEM, "alert: rule approved")
s.note(20, "<b>Shadow, then activate an AUTO_APPROVE rule</b>", w=330, h=24)
s.m(APPR, API, "publish policy version (rule in SHADOW)")
s.m(API, PG, "new immutable manifest; move pointer; audit")
s.m(APPR, API, "request activation (agreement ≥ threshold, specificity passed)")
s.m(OWN, API, "co-sign activation (second person; step-up)")
s.m(API, PG, "publish manifest with rule ACTIVE; two signatures; audit")
s.m(API, SIEM, "alert: rule activated")
s.note(20, "<b>Pause (always safe)</b>", w=170, h=24)
s.m(OWN, API, "pause rule or engine (mandatory reason)")
s.m(API, PG, "SELECT policy_control FOR UPDATE; revision + 1; control_event; COMMIT")
s.m(API, SIEM, "alert: paused")
s.note(API - 150, "next evaluation: affected requests → HUMAN_REVIEW;<br>in-flight submits fail the revision check", w=320, h=40)
s.note(20, "<b>Audit anchoring and verification</b>", w=260, h=24)
s.m(ANC, PG, "read audit tail (last_seq, last_hash, count)")
s.m(ANC, KV, "sign(head) with non-exportable key")
s.m(KV, ANC, "signature + key version", ret=True)
s.m(ANC, BLOB, "write anchor {last_seq, last_hash, count, key_version, signature}")
s.m(ANC, PG, "nightly: verify chain against latest anchor")
s.m(ANC, SIEM, "alert (Sev-1) on verification or anchor failure")
p5.note("<b>Rules</b><br>• Author cannot approve; admin cannot hold policy roles<br>"
        "• Auto-approve activation needs two people other than the author<br>"
        "• Resume needs an approver (two people for auto-approve rules)<br>"
        "• Rolling back the app never changes rule data", 20, s.y + 20, 480, 90)

pages = [p1, p2, p3, p4, p5]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    f.write('<mxfile host="app.diagrams.net" type="device">' + "".join(pg_.xml() for pg_ in pages) + "</mxfile>")
print("wrote", OUT)
