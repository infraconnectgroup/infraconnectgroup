import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

const SITE_URL =
  "https://businessclub-alislah.nl";

const AGENDA_URL =
  `${SITE_URL}/portaal/agenda`;

function fmt(d: Date) {
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+/,"");
}

function buildIcs(
  title:string,
  desc:string,
  location:string,
  start:Date,
  end?:Date,
) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    `UID:${crypto.randomUUID()}`,
    `DTSTART:${fmt(start)}`,
    end
      ? `DTEND:${fmt(end)}`
      : "",
    `SUMMARY:${title}`,
    `DESCRIPTION:${desc}`,
    `LOCATION:${location}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  .filter(Boolean)
  .join("\r\n");
}

Deno.serve(async (req)=>{

if(req.method==="OPTIONS"){
return new Response(
"ok",
{headers:corsHeaders},
);
}

try{

const authHeader=
req.headers.get(
"Authorization"
)??"";

const body=
await req.json();

const admin=
createClient(
Deno.env.get(
"SUPABASE_URL"
)!,
Deno.env.get(
"SUPABASE_SERVICE_ROLE_KEY"
)!,
);

const {
data:userData
}=
await admin.auth.getUser(
authHeader.replace(
"Bearer ",
"",
),
);

const user=
userData.user;

if(
!user?.email
){
return json({
ok:true
});
}

const {
data:ev
}=
await admin
.from("events")
.select(`
title,
description,
event_date,
end_time,
location
`)
.eq(
"id",
body.event_id,
)
.single();

const start=
new Date(
ev.event_date,
);

let end:
Date|undefined;

if(
ev.end_time
){
const[
h,
m
]=String(
ev.end_time
)
.split(":")
.map(Number);

end=
new Date(
start,
);

end.setHours(
h||0,
m||0,
0,
0,
);
}

const maps=
ev.location
?`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`
:"";

const ics=
buildIcs(
ev.title,
ev.description??"",
ev.location??"",
start,
end,
);

const ics64=
btoa(
ics,
);

const html=`

<h2>
Aanmelding bevestigd
</h2>

<p>
<strong>
${ev.title}
</strong>
</p>

<p>
Datum:
${ev.event_date}
</p>

${
ev.end_time
?`
<p>
Eindtijd:
${ev.end_time}
</p>
`
:""
}

${
ev.location
?`
<p>
Locatie:
${ev.location}
</p>
`
:""
}

${
ev.description
?`
<p>
${ev.description}
</p>
`
:""
}

${
maps
?`
<p>
<a href="${maps}">
Open locatie
</a>
</p>
`
:""
}

<p>
Agenda bestand
bijgevoegd
</p>

<p>
<a href="${AGENDA_URL}">
Bekijk mijn
aanmeldingen
</a>
</p>
`;

const res=
await fetch(
"https://api.resend.com/emails",
{
method:"POST",

headers:{
Authorization:
`Bearer ${
Deno.env.get(
"RESEND_API_KEY"
)
}`,
"Content-Type":
"application/json",
},

body:
JSON.stringify(
{
from:
"Businessclub Al Islah <info@businessclub-alislah.nl>",

to:[
user.email
],

subject:
`Bevestiging aanmelding – ${ev.title}`,

html,

attachments:[
{
filename:
"event.ics",

content:
ics64,
},
],
},
),
},
);

console.log(
"[event-register-notify] resend response",
res.status,
);

return json({
ok:true
});

}catch(e){

console.error(e);

return json(
{ok:false},
500,
);

}

});
