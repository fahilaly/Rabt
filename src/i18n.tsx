import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Arabic first, English second. Code is written with English strings; `t()` looks
// them up here. Templates use {name} placeholders. `tr()` translates text the store
// already saved in English (notices, timeline, SMS) by matching these templates,
// so stored data stays language-neutral. `p()` translates names and places.
// ---------------------------------------------------------------------------

export type Lang = "ar" | "en";

const AR: Record<string, string> = {
  // shell
  Rabt: "ربط",
  "Pilgrim pickup from hospital": "نقل الحجاج من المستشفى",
  Hospital: "المستشفى",
  Company: "الشركة",
  Transport: "النقل",
  Driver: "السائق",
  Role: "الدور",
  Sections: "الأقسام",
  "{label} (press {key})": "{label} (اضغط {key})",
  "Recovery ward": "قسم المتحسنين",
  Patients: "المرضى",
  "Register pilgrim": "تسجيل حاج",
  "Pickup requests": "طلبات النقل",
  "Pilgrims in hospital": "الحجاج في المستشفى",
  Completed: "المكتملة",
  "Driver app": "تطبيق السائق",
  "Fleet dispatch": "توزيع الأسطول",
  "Start demo": "ابدأ العرض",
  Messages: "الرسائل",
  "Demo clock": "ساعة العرض",
  "+{n} min": "+{n} د",
  "Reset sample data": "إعادة البيانات التجريبية",
  "Synced: open this link on another device to see the same data.": "متزامن: افتح الرابط على جهاز آخر لترى البيانات نفسها.",
  "Sample data. Syncs between tabs in this browser.": "بيانات تجريبية، تتزامن بين نوافذ هذا المتصفح.",
  Notifications: "الإشعارات",
  "Notifications, {n} new": "الإشعارات، {n} جديدة",
  "Company drivers": "سائقو الشركات",
  "Fleet partner drivers": "سائقو شريك الأسطول",
  "{name}'s phone": "هاتف {name}",
  "SMS sent by Rabt": "رسائل ربط النصية",
  "Full plan": "الباقة الكاملة",
  "Basic plan": "الباقة الأساسية",
  English: "English",
  Arabic: "العربية",
  // status
  "In treatment": "تحت العلاج",
  "Pickup requested": "طُلب النقل",
  "Rabt ride requested": "طُلبت رحلة ربط",
  "Driver assigned": "عُيّن سائق",
  "On the way": "في الطريق",
  "Picked up": "تم الاستلام",
  Arrived: "وصل",
  "Late {n} min": "متأخر {n} د",
  Ready: "جاهز",
  "Vehicle assigned": "عُيّنت مركبة",
  "Driver accepted": "قبل السائق",
  "Pickup steps": "مراحل النقل",
  Close: "إغلاق",
  "No notifications.": "لا توجد إشعارات.",
  now: "الآن",
  "{n} min": "{n} د",
  "{h} h": "{h} س",
  "{h} h {m} min": "{h} س {m} د",
  "{n} km": "{n} كم",
  "Shared with the company": "يُشارك مع الشركة",
  "Name, ID, hospital, stage, expected ready time, expected pickup time, mobility.":
    "الاسم ورقم الهوية والمستشفى والمرحلة ووقت الجاهزية المتوقع وموعد النقل والحركة.",
  "Never shared": "لا يُشارك أبداً",
  "Diagnosis, clinical notes, results.": "التشخيص والملاحظات السريرية والنتائج.",
  // board
  "Exit full screen": "الخروج من ملء الشاشة",
  "Full screen": "ملء الشاشة",
  waiting: "بالانتظار",
  late: "متأخر",
  longest: "الأطول",
  Pilgrim: "الحاج",
  Vehicle: "المركبة",
  Due: "موعد الوصول",
  Status: "الحالة",
  Wait: "الانتظار",
  Wheelchair: "كرسي متحرك",
  Walking: "يمشي",
  "Rabt estimate, not yet confirmed by the driver": "تقدير ربط، لم يؤكده السائق بعد",
  "No patients waiting for transport.": "لا يوجد مرضى بانتظار النقل.",
  "Left the ward": "غادر القسم",
  "Wait = minutes since the patient was confirmed ready. ~ = Rabt estimate until the driver confirms. Rows turn red when a vehicle passes its arrival time.":
    "الانتظار = الدقائق منذ تأكيد جاهزية المريض. ~ = تقدير ربط حتى يؤكد السائق. يتحول الصف إلى الأحمر إذا تجاوزت المركبة موعد وصولها.",
  "Waiting for company": "بانتظار الشركة",
  "Finding a driver": "البحث عن سائق",
  "Recovery ward board": "لوحة قسم المتحسنين",
  // patients
  "{a} in treatment · {b} waiting for transport": "{a} تحت العلاج · {b} بانتظار النقل",
  "{n} vehicle late": "{n} مركبة متأخرة",
  Active: "الحاليون",
  Waiting: "بالانتظار",
  Left: "غادروا",
  Filter: "تصفية",
  "Name, ID or company": "الاسم أو الرقم أو الشركة",
  ID: "الرقم",
  Since: "منذ",
  "No patients match this filter.": "لا يوجد مرضى مطابقون.",
  "{time} ({dur})": "{time} ({dur})",
  " · ready ~{time}": " · جاهز ~{time}",
  "left {time}": "غادر {time}",
  // patient drawer
  "Record diagnosis": "تسجيل التشخيص",
  "Ready for transport": "جاهز للنقل",
  "The diagnosis stays in the hospital. {company} is told only the expected ready time.":
    "يبقى التشخيص داخل المستشفى، وتُبلَّغ {company} بوقت الجاهزية المتوقع فقط.",
  "Expected ready around {time}, {dur} ago. Shared with {company}.": "الجاهزية المتوقعة نحو {time}، قبل {dur}. شوركت مع {company}.",
  "Expected ready around {time}, in {dur}. Shared with {company}.": "الجاهزية المتوقعة نحو {time}، بعد {dur}. شوركت مع {company}.",
  "Change estimate": "تعديل التقدير",
  "Waiting for {company} to send a vehicle.": "بانتظار أن ترسل {company} مركبة.",
  "{company} requested a Rabt ride. The fleet partner is assigning a driver.": "طلبت {company} رحلة ربط، وشريك الأسطول يعيّن سائقاً.",
  "{driver} assigned ({vehicle}, {plate}). Not accepted yet.": "عُيّن {driver} ({vehicle}، {plate}). لم يقبل بعد.",
  "{driver} due {time} · {vehicle} {plate}": "{driver} يصل {time} · {vehicle} {plate}",
  "{driver} due {time}, {n} min late · {vehicle} {plate}": "{driver} موعده {time}، متأخر {n} د · {vehicle} {plate}",
  "Nusuk card": "بطاقة نسك",
  Booking: "الحجز",
  Umrah: "عمرة",
  Hajj: "حج",
  "{company} ({type})": "{company} ({type})",
  Nationality: "الجنسية",
  "{country}, {age}": "{country}، {age}",
  Accommodation: "السكن",
  Admitted: "الدخول",
  "{time}, {hospital}": "{time}، {hospital}",
  Mobility: "الحركة",
  "Clinical note": "الملاحظة السريرية",
  "(hospital only)": "(للمستشفى فقط)",
  Timeline: "السجل الزمني",
  // diagnosis
  "Diagnosis for {name}": "تشخيص {name}",
  "Condition group": "فئة الحالة",
  "Heat exhaustion": "إجهاد حراري",
  Dehydration: "جفاف",
  "Minor injury (sprain, cut)": "إصابة بسيطة (التواء، جرح)",
  "Blood sugar (low or high)": "سكر الدم (انخفاض أو ارتفاع)",
  "Breathing (asthma, COPD)": "التنفس (ربو، انسداد رئوي)",
  "Chest pain, observation": "ألم في الصدر، تحت الملاحظة",
  Other: "أخرى",
  "Clinical note (optional, hospital only)": "ملاحظة سريرية (اختيارية، للمستشفى فقط)",
  "e.g. IV fluids, observe 2 h": "مثال: محاليل وريدية، ملاحظة ساعتين",
  "Expected ready in": "الجاهزية المتوقعة خلال",
  "Rabt suggests {dur}, typical for {condition} (sample figures).": "يقترح ربط {dur}، وهي المدة المعتادة لحالة {condition} (أرقام تجريبية).",
  "{company} receives the expected ready time only, never the diagnosis.": "تتلقى {company} وقت الجاهزية المتوقع فقط، ولا ترى التشخيص أبداً.",
  Cancel: "إلغاء",
  "Save and tell {company}": "حفظ وإبلاغ {company}",
  // ready checklist
  "Discharge medicines dispensed": "صُرفت أدوية الخروج",
  "Discharge instructions given in the patient's language": "أُعطيت تعليمات الخروج بلغة المريض",
  "Cleared for ordinary transport, no medical escort": "مسموح بالنقل العادي دون مرافق طبي",
  "Wheelchair, accessible vehicle needed": "كرسي متحرك، يحتاج مركبة مجهزة",
  "Patients needing an ambulance or medical escort go through the hospital's clinical transfer, not Rabt.":
    "من يحتاج إسعافاً أو مرافقاً طبياً يُنقل عبر النقل السريري للمستشفى، لا عبر ربط.",
  "Send request to {company}": "إرسال الطلب إلى {company}",
  // register
  "Links this visit to the company responsible for the pilgrim.": "يربط هذه الزيارة بالشركة المسؤولة عن الحاج.",
  "Identify by": "التعريف بواسطة",
  "Nusuk card (Hajj)": "بطاقة نسك (حج)",
  "Company booking (Umrah)": "حجز الشركة (عمرة)",
  "Card number": "رقم البطاقة",
  "Booking reference": "رقم الحجز",
  "Look up": "بحث",
  "Sample numbers:": "أرقام تجريبية:",
  "No pilgrim found with that number.": "لم يُعثر على حاج بهذا الرقم.",
  "{name} is already registered.": "{name} مسجّل مسبقاً.",
  "Company manager": "مدير الشركة",
  "Register at emergency": "تسجيل في الطوارئ",
  "The company is told their pilgrim is at this hospital. No diagnosis is shared.": "تُبلَّغ الشركة بوجود حاجّها في هذا المستشفى، دون أي تشخيص.",
  "Prototype lookup with sample records. A live version needs authorised access to Nusuk and company booking data.":
    "بحث تجريبي بسجلات نموذجية. تحتاج النسخة الفعلية إلى صلاحية وصول لبيانات نسك وحجوزات الشركات.",
  // company
  "Vehicle late for {name}.": "تأخرت مركبة {name}.",
  "{n} vehicles are late.": "تأخرت {n} مركبات.",
  "The hospital can see the delay on its ward board.": "يرى المستشفى التأخير على لوحة القسم.",
  Open: "فتح",
  "{company} · Full plan, Rabt rides available · {n} still in treatment": "{company} · الباقة الكاملة، رحلات ربط متاحة · {n} تحت العلاج",
  "{company} · Basic plan, own vehicles · {n} still in treatment": "{company} · الباقة الأساسية، مركبات الشركة · {n} تحت العلاج",
  "Need a vehicle": "بانتظار مركبة",
  Needs: "الاحتياج",
  Actions: "إجراءات",
  "To {place}": "إلى {place}",
  "Ward {phone}": "القسم {phone}",
  "Send our vehicle": "أرسل مركبتنا",
  "No pickups waiting. New requests appear here when a hospital confirms a pilgrim is ready.":
    "لا توجد طلبات. تظهر هنا الطلبات الجديدة عندما يؤكد المستشفى جاهزية الحاج.",
  "In progress": "قيد التنفيذ",
  "Fleet partner assigning": "شريك الأسطول يعيّن سائقاً",
  " · Rabt ride": " · رحلة ربط",
  " · own": " · مركبة الشركة",
  "Nothing in progress.": "لا شيء قيد التنفيذ.",
  "Still in treatment": "ما زالوا تحت العلاج",
  "Expected ready": "الجاهزية المتوقعة",
  "None of your pilgrims are in treatment.": "لا يوجد من حجاجكم تحت العلاج.",
  "Waiting for the doctor": "بانتظار الطبيب",
  " · in {dur}": " · بعد {dur}",
  " · any time now": " · في أي لحظة",
  "Rabt ride: Full plan": "رحلة ربط: الباقة الكاملة",
  "Request Rabt ride": "اطلب رحلة ربط",
  "Send a vehicle for {name}": "إرسال مركبة إلى {name}",
  " · accessible": " · مجهزة",
  " · on another trip": " · في رحلة أخرى",
  "Now at {place}": "الآن في {place}",
  "This pilgrim uses a wheelchair and this vehicle isn't marked accessible.": "يستخدم هذا الحاج كرسياً متحركاً، وهذه المركبة غير مجهزة.",
  "Times are Rabt's estimate to reach the hospital. The driver confirms an arrival time on their phone, and the hospital sees it on the ward board.":
    "الأوقات تقدير ربط للوصول إلى المستشفى. يؤكد السائق موعد وصوله من هاتفه ويراه المستشفى على لوحة القسم.",
  "No drivers set up for this company.": "لا يوجد سائقون مسجلون لهذه الشركة.",
  "Assign driver": "تعيين السائق",
  "Where each of your pilgrims is. Clinical details stay with the hospital.": "أين يوجد كل حاج من حجاجكم. التفاصيل السريرية تبقى لدى المستشفى.",
  "None of your pilgrims are in hospital.": "لا يوجد من حجاجكم في المستشفى.",
  "{n} pickups · median wait in the ward {dur}": "{n} عمليات نقل · وسيط الانتظار في القسم {dur}",
  "No completed pickups yet": "لا توجد عمليات نقل مكتملة بعد",
  "Completed pickups are listed here with every time.": "تظهر هنا عمليات النقل المكتملة بكل أوقاتها.",
  "Waiting in the ward for {dur}.": "ينتظر في القسم منذ {dur}.",
  "In treatment since {time}.": "تحت العلاج منذ {time}.",
  "Expected ready around {time}. You will get a pickup request when the hospital confirms.": "الجاهزية المتوقعة نحو {time}. سيصلكم طلب النقل عندما يؤكد المستشفى.",
  "The hospital has not given an expected ready time yet.": "لم يحدد المستشفى وقت الجاهزية المتوقع بعد.",
  "Ward phone": "هاتف القسم",
  "Due at hospital": "موعد الوصول للمستشفى",
  "{time}, {n} min late": "{time}، متأخر {n} د",
  "{hospital}, {area}": "{hospital}، {area}",
  "{driver}, {vehicle} {plate}": "{driver}، {vehicle} {plate}",
  // transport
  "Fleet partner": "شريك الأسطول",
  "Driver phone screen": "شاشة هاتف السائق",
  "Rabt Driver": "ربط للسائقين",
  "No trips right now. New pickups appear here when they are assigned to you.": "لا توجد رحلات الآن. تظهر هنا الرحلات الجديدة عند تعيينها لك.",
  "Trip log": "سجل الرحلات",
  From: "من",
  To: "إلى",
  Accepted: "القبول",
  "No trips yet.": "لا توجد رحلات بعد.",
  "New pickup": "رحلة جديدة",
  "Go to hospital": "توجّه إلى المستشفى",
  "Take to accommodation": "أوصله إلى السكن",
  "{hospital}, recovery ward": "{hospital}، قسم المتحسنين",
  "Wheelchair user": "يستخدم كرسياً متحركاً",
  "I can be at the hospital in": "أصل إلى المستشفى خلال",
  "Rabt estimate: {n} min": "تقدير ربط: {n} د",
  "Arrival time": "موعد الوصول",
  "Accept pickup": "قبول الرحلة",
  "{n} min late. The company has been alerted.": "متأخر {n} د. تم تنبيه الشركة.",
  "Due at the hospital {time}": "الوصول إلى المستشفى {time}",
  "Pilgrim picked up": "تم استلام الحاج",
  "Arrived at accommodation": "وصل إلى السكن",
  "Licensed transport partner · {a} open · {b} in progress · {c} of {d} drivers free": "شريك النقل المرخّص · {a} مفتوحة · {b} قيد التنفيذ · {c} من {d} سائقين متاحون",
  "Open ride requests": "طلبات الرحلات المفتوحة",
  Pickup: "الاستلام",
  "Driver for {name}": "سائق {name}",
  "Choose driver": "اختر سائقاً",
  " · on a trip": " · في رحلة",
  Assign: "تعيين",
  "No open requests. Companies on the Full plan request rides from their pickup screen.": "لا توجد طلبات مفتوحة. تطلب شركات الباقة الكاملة الرحلات من شاشة طلبات النقل.",
  "No rides in progress.": "لا توجد رحلات قيد التنفيذ.",
  // demo
  Demo: "العرض",
  Follow: "متابعة",
  Play: "تشغيل",
  Pause: "إيقاف مؤقت",
  Next: "التالي",
  Replay: "إعادة",
  "Exit demo": "إنهاء العرض",
  "Simulated SMS": "رسائل نصية تجريبية",
  "Close messages": "إغلاق الرسائل",
  "To {name}": "إلى {name}",
  "No messages yet.": "لا توجد رسائل بعد.",
  "Simulated. In a live version these go out by SMS or WhatsApp.": "محاكاة. في النسخة الفعلية تُرسل برسالة نصية أو واتساب.",
  "SMS to {name}": "رسالة إلى {name}",
  "A pilgrim arrives at emergency": "حاج يصل إلى الطوارئ",
  "Ahmad Fauzi, 59, an Umrah pilgrim from Indonesia, collapses in the heat and is brought to Al-Haram East Hospital. The desk enters his booking number and Rabt finds his company, Al-Safwa Umrah.":
    "أحمد فوزي، 59 عاماً، معتمر من إندونيسيا، يسقط من شدة الحر ويُنقل إلى مستشفى الحرم الشرقي. يُدخل موظف الاستقبال رقم حجزه فيجد ربط شركته: الصفوة للعمرة.",
  "The company knows at once": "الشركة تعلم فوراً",
  "{manager}, the {company} manager, gets an SMS and sees Ahmad under Pilgrims in hospital: where he is, not why. No phone calls between hospital and company.":
    "يتلقى {manager}، مدير {company}، رسالة نصية ويرى أحمد ضمن «الحجاج في المستشفى»: أين هو، لا ما به. لا اتصالات هاتفية بين المستشفى والشركة.",
  "Diagnosis and time estimate": "التشخيص وتقدير الوقت",
  "The doctor records heat exhaustion. Rabt suggests a typical stay of 2 hours for this condition and the doctor confirms. The diagnosis stays inside the hospital.":
    "يسجل الطبيب إجهاداً حرارياً. يقترح ربط مدة بقاء معتادة قدرها ساعتان لهذه الحالة فيؤكدها الطبيب. يبقى التشخيص داخل المستشفى.",
  "The company plans ahead": "الشركة تخطط مسبقاً",
  "Al-Safwa receives only the expected ready time, around {time}, by SMS and on screen. It can line up a vehicle instead of waiting for a call.":
    "تتلقى الصفوة وقت الجاهزية المتوقع فقط، نحو {time}، برسالة نصية وعلى الشاشة، فتجهّز مركبة بدل انتظار اتصال.",
  "Two hours later the nurse ticks the three-item checklist and taps Ready for transport. Ahmad appears on the recovery-ward board and the company gets a pickup request by SMS.":
    "بعد ساعتين تؤشر الممرضة على قائمة التحقق الثلاثية وتضغط «جاهز للنقل». يظهر أحمد على لوحة قسم المتحسنين ويصل الشركة طلب نقل برسالة نصية.",
  "The nearest vehicle is sent": "إرسال أقرب مركبة",
  "Rabt lists Al-Safwa's drivers by travel time. {driver} is {n} min away. One tap assigns him and texts him the pickup.":
    "يرتب ربط سائقي الصفوة حسب زمن الوصول. {driver} على بعد {n} د. بضغطة واحدة يُعيَّن وتصله الرحلة برسالة.",
  "Rabt lists the company's drivers by travel time and the nearest one is assigned.": "يرتب ربط سائقي الشركة حسب زمن الوصول ويُعيَّن أقربهم.",
  "The driver accepts": "السائق يقبل",
  "{driver} accepts on his phone and confirms he will be at the hospital by {time}. The ward board now shows that time.":
    "يقبل {driver} من هاتفه ويؤكد وصوله إلى المستشفى بحلول {time}. تعرض لوحة القسم هذا الموعد الآن.",
  "Running late, alert sent": "تأخير وإرسال تنبيه",
  "Traffic near the Haram. The promised time passes, the row turns red, and Rabt texts the company manager automatically. Nobody has to chase anyone by phone.":
    "زحام قرب الحرم. يمضي الموعد فيتحول الصف إلى الأحمر، ويرسل ربط تلقائياً رسالة إلى مدير الشركة. لا حاجة لملاحقة أحد بالهاتف.",
  "{driver} arrives and taps Picked up. Ahmad leaves the recovery ward and the board updates for the nurses.":
    "يصل {driver} ويضغط «تم الاستلام». يغادر أحمد قسم المتحسنين وتتحدث اللوحة أمام الممرضين.",
  "Home, case closed": "في السكن، أُغلقت الحالة",
  "Ahmad is back at his hotel. Every step was timestamped, including how long he waited in the ward. Those times feed the reports and the time estimates.":
    "عاد أحمد إلى فندقه. سُجّل وقت كل خطوة، ومنها مدة انتظاره في القسم، وتغذي هذه الأوقات التقارير وتقديرات الوقت.",
  "The driver": "السائق",
  "Assessment in progress": "قيد التقييم",
};

// Sentences the store saves in English (notices, timeline, SMS). tr() matches these.
const AR_STORED: Record<string, string> = {
  "{name} is being treated at {hospital}": "{name} يتلقى العلاج في {hospital}",
  "{name} expected ready around {time}": "الجاهزية المتوقعة لـ{name} نحو {time}",
  "Pickup requested for {name} at {hospital}": "طُلب نقل {name} من {hospital}",
  "New pickup: {name}": "رحلة جديدة: {name}",
  "New Rabt ride request: {name} at {hospital}": "طلب رحلة ربط جديد: {name} في {hospital}",
  "Rabt driver assigned for {name}: {driver}": "عُيّن سائق ربط لـ{name}: {driver}",
  "{driver} accepted {name}, arriving {time}": "قبل {driver} نقل {name}، يصل {time}",
  "Vehicle for {name} arriving {time} ({vehicle}, {plate})": "مركبة {name} تصل {time} ({vehicle}، {plate})",
  "{name} has left the hospital": "غادر {name} المستشفى",
  "{name} arrived at the accommodation. Case closed.": "وصل {name} إلى السكن. أُغلقت الحالة.",
  "Vehicle late for {name}: arrival time passed ({driver})": "تأخرت مركبة {name}: تجاوزت موعد الوصول ({driver})",
  "Vehicle late for {name}: arrival time passed": "تأخرت مركبة {name}: تجاوزت موعد الوصول",
  "Vehicle late for {name}. The company manager has been alerted.": "تأخرت مركبة {name}. تم تنبيه مدير الشركة.",
  "Registered at emergency": "سُجّل في الطوارئ",
  "Admitted to ward": "أُدخل إلى الجناح",
  "Diagnosis recorded. Expected ready around {time}": "سُجّل التشخيص. الجاهزية المتوقعة نحو {time}",
  "Ready for transport ({mobility}), pickup requested": "جاهز للنقل ({mobility})، طُلب النقل",
  "Ready for transport, pickup requested": "جاهز للنقل، طُلب النقل",
  "Own vehicle assigned: {driver}": "عُيّنت مركبة الشركة: {driver}",
  "Partner driver assigned: {driver}": "عُيّن سائق الشريك: {driver}",
  "Driver accepted, arriving in {n} min": "قبل السائق، يصل خلال {n} د",
  "Picked up from hospital": "استُلم من المستشفى",
  "Vehicle late: arrival time passed. Company manager alerted": "تأخرت المركبة عن موعدها. تم تنبيه مدير الشركة",
  "Vehicle late: arrival time passed": "تأخرت المركبة عن موعدها",
  "Rabt: your pilgrim {name} ({id}) is being treated at {hospital}. We will send the expected ready time.":
    "ربط: حاجّكم {name} ({id}) يتلقى العلاج في {hospital}. سنرسل لكم وقت الجاهزية المتوقع.",
  "Rabt: {name} is expected to be ready around {time} at {hospital}. Plan a vehicle; we will confirm when ready.":
    "ربط: يُتوقع أن يكون {name} جاهزاً نحو {time} في {hospital}. جهّزوا مركبة، وسنؤكد عند الجاهزية.",
  "Rabt: {name} is ready for pickup at {hospital}, recovery ward ({phone}). Needs an accessible vehicle. Open Rabt to send a vehicle.":
    "ربط: {name} جاهز للنقل من {hospital}، قسم المتحسنين ({phone}). يحتاج مركبة مجهزة. افتحوا ربط لإرسال مركبة.",
  "Rabt: {name} is ready for pickup at {hospital}, recovery ward ({phone}). Open Rabt to send a vehicle.":
    "ربط: {name} جاهز للنقل من {hospital}، قسم المتحسنين ({phone}). افتحوا ربط لإرسال مركبة.",
  "Rabt: new pickup. {name} at {hospital}, recovery ward, to {place}. Open the driver app to accept.":
    "ربط: رحلة جديدة. {name} في {hospital}، قسم المتحسنين، إلى {place}. افتح تطبيق السائق للقبول.",
  "Rabt: fleet driver {driver} ({plate}) assigned for {name}.": "ربط: عُيّن سائق الأسطول {driver} ({plate}) لـ{name}.",
  "Rabt ALERT: the vehicle for {name} is late. {driver} ({phone}) promised {time}. The hospital can see the delay.":
    "تنبيه ربط: تأخرت مركبة {name}. وعد {driver} ({phone}) بالوصول {time}. يرى المستشفى التأخير.",
  "Rabt: {name} arrived at {place} at {time}. Case closed.": "ربط: وصل {name} إلى {place} الساعة {time}. أُغلقت الحالة.",
};

Object.assign(AR, AR_STORED);

// Names and places (sample data).
const P: Record<string, string> = {
  "Siti Rahmawati": "سيتي رحمواتي",
  "Muhammad Aslam": "محمد أسلم",
  "Hassan Abdel-Rahman": "حسن عبد الرحمن",
  "Aminah Bello": "أمينة بيلو",
  "Yusuf Demir": "يوسف دمير",
  "Fatima Zahra Idrissi": "فاطمة الزهراء الإدريسي",
  "Abdullah Al-Qahtani": "عبدالله القحطاني",
  "Nurul Huda Ismail": "نور الهدى إسماعيل",
  "Ali Reza Karimi": "علي رضا كريمي",
  "Ibrahim Diallo": "إبراهيم ديالو",
  "Khadija Mansour": "خديجة منصور",
  "Saleh Al-Mutairi": "صالح المطيري",
  "Ahmad Fauzi": "أحمد فوزي",
  "Mariam Haddad": "مريم حداد",
  "Bilal Chaudhry": "بلال تشودري",
  "Al-Haram East Hospital": "مستشفى الحرم الشرقي",
  "Mina Valley Hospital": "مستشفى وادي منى",
  "Aziziyah Medical Center": "مركز العزيزية الطبي",
  "Al-Haram East": "الحرم الشرقي",
  "Mina Valley": "وادي منى",
  "Aziziyah Medical": "العزيزية الطبي",
  "Central Makkah": "وسط مكة",
  Mina: "منى",
  Aziziyah: "العزيزية",
  "Al-Safwa Umrah": "الصفوة للعمرة",
  "Rawasi Hajj Campaign": "حملة رواسي للحج",
  "Noor Al-Huda Tours": "نور الهدى للسياحة",
  "Rakan Al-Dosari": "راكان الدوسري",
  "Omar Al-Ghamdi": "عمر الغامدي",
  "Hind Al-Subaie": "هند السبيعي",
  "Saeed Al-Malki": "سعيد المالكي",
  "Turki Al-Shehri": "تركي الشهري",
  "Khalid Al-Harbi": "خالد الحربي",
  "Nasser Al-Zahrani": "ناصر الزهراني",
  "Majed Al-Otaibi": "ماجد العتيبي",
  "Faisal Al-Juhani": "فيصل الجهني",
  "Toyota HiAce": "تويوتا هايس",
  "Hyundai H-1": "هيونداي H-1",
  "Toyota Coaster": "تويوتا كوستر",
  "Ford Transit (accessible)": "فورد ترانزيت (مجهزة)",
  "Hyundai Staria": "هيونداي ستاريا",
  "Ibrahim Al-Khalil St": "شارع إبراهيم الخليل",
  Ajyad: "أجياد",
  "Al-Awali": "العوالي",
  "Al-Shisha": "الششة",
  "Al-Masa Hotel": "فندق الماسة",
  Indonesia: "إندونيسيا",
  Pakistan: "باكستان",
  Egypt: "مصر",
  Nigeria: "نيجيريا",
  Türkiye: "تركيا",
  Morocco: "المغرب",
  "Saudi Arabia": "السعودية",
  Malaysia: "ماليزيا",
  Iran: "إيران",
  Senegal: "السنغال",
  Jordan: "الأردن",
  Lebanon: "لبنان",
  Desk: "مكتب الطوارئ",
  "Recovery ward": "قسم المتحسنين",
  "Fleet dispatch": "توزيع الأسطول",
  "Emergency doctor": "طبيب الطوارئ",
  Rabt: "ربط",
  walking: "يمشي",
  wheelchair: "كرسي متحرك",
};

const PART_RULES: [RegExp, string][] = [
  [/^room (\d+)$/, "غرفة $1"],
  [/^tent (\d+)$/, "خيمة $1"],
  [/^Camp (\d+)$/, "مخيم $1"],
  [/^Building (\d+)$/, "مبنى $1"],
  [/^Tower (\w)$/, "برج $1"],
  [/^Ward (\d+)$/, "جناح $1"],
];

function properAr(x: string): string {
  if (P[x]) return P[x];
  if (x.includes(", ")) return x.split(", ").map(properAr).join("، ");
  for (const [re, out] of PART_RULES) if (re.test(x)) return x.replace(re, out);
  return x;
}

// templates with placeholders, longest first, compiled for reverse matching
const TEMPLATES = Object.keys(AR_STORED)
  .filter((k) => k.includes("{"))
  .sort((a, b) => b.length - a.length)
  .map((k) => {
    const names: string[] = [];
    const src = k.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{(\w+)\}/g, (_m, a) => {
      names.push(a);
      return "(.+?)";
    });
    return { key: k, names, re: new RegExp("^" + src + "$") };
  });

// numbers, phones, plates and times stay left-to-right inside Arabic text
const LTR_RUN = /^[\x20-\x7E]*\d[\x20-\x7E]*$/;
const isolate = (v: string) => (LTR_RUN.test(v) && /[\s:]/.test(v) ? "\u2066" + v + "\u2069" : v);

function fill(tpl: string, vars: Record<string, string | number>, map: (s: string) => string, rtl: boolean) {
  return tpl.replace(/\{(\w+)\}/g, (_m, k) => {
    if (!(k in vars)) return `{${k}}`;
    const v = map(String(vars[k]));
    return rtl ? isolate(v) : v;
  });
}

export interface T {
  lang: Lang;
  /** translate a UI string (English is the key) */
  t: (en: string, vars?: Record<string, string | number>) => string;
  /** translate a stored English sentence (notice, timeline, SMS) */
  tr: (text: string) => string;
  /** translate a name or place from the sample data */
  p: (x: string) => string;
  /** duration in minutes, localized */
  dur: (min: number) => string;
}

export function makeT(lang: Lang): T {
  const p = (x: string) => (lang === "ar" ? properAr(x) : x);
  const t = (en: string, vars?: Record<string, string | number>) => {
    const tpl = lang === "ar" ? (AR[en] ?? en) : en;
    return vars ? fill(tpl, vars, p, lang === "ar") : tpl;
  };
  const tr = (text: string) => {
    if (lang !== "ar" || !text) return text;
    if (AR[text]) return AR[text];
    for (const m of TEMPLATES) {
      const r = m.re.exec(text);
      if (!r) continue;
      const vars: Record<string, string> = {};
      m.names.forEach((n, i) => (vars[n] = r[i + 1]));
      return fill(AR[m.key], vars, properAr, true);
    }
    return properAr(text);
  };
  const dur = (min: number) => {
    if (min < 60) return t("{n} min", { n: min });
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? t("{h} h {m} min", { h, m }) : t("{h} h", { h });
  };
  return { lang, t, tr, p, dur };
}

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "ar", setLang: () => {} });
const KEY = "rabt-lang";

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v === "en" || v === "ar" ? v : "ar";
    } catch {
      return "ar";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  return <LangCtx.Provider value={{ lang, setLang }}>{children}</LangCtx.Provider>;
}

export function useT(): T & { setLang: (l: Lang) => void } {
  const { lang, setLang } = useContext(LangCtx);
  return useMemo(() => ({ ...makeT(lang), setLang }), [lang, setLang]);
}
