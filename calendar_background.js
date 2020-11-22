const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const today = new Date();
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

function sameDate(a, b) {
  return a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getSemanticDate(date) {
  if (sameDate(date, today)) {
    return "Today";
  }

  if (sameDate(date, tomorrow)) {
    return "Tomorrow";
  }

  return daysOfWeek[date.getDay()];
}

function getEventType(title) {
  if (title.includes(" - Due")) {
    return "assignment";
  }

  if (title.includes(" - Availability Ends")) {
    return "quiz";
  }

  if (title.toLowerCase().includes("office hour")) {
    return "office";
  }

  return "lecture";
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // We'll only handle "calendar" requests
  if (request.type !== "calendar") {
    return;
  }

  // The first network request sets the calendar page to the "Agenda" view
  // Otherwise it may be on another view and our scraping won't work
  $.post("https://mycourses.rit.edu/d2l/le/calendar/6605/periodfilter/save", {
    periodFilter: 5, // 5 is for "Agenda"
    d2l_referrer: request.token, // comes from myCourses local storage
  }).always(({ status }) => {
    // For some reason jQuery's .done() method never works for this request
    // So we just use .always() and double check for success here
    if (status !== 200) {
      sendResponse(null);
    }

    // Now we actually request the calendar page
    $.get("https://mycourses.rit.edu/d2l/le/calendar/6605")
      .done((response) => {
        const eventGroups = [];
        $(response)
          .find("div > div > .d2l-collapsepane")
          .each(function () {
            // For each event group...
            const newGroup = {
              date: getSemanticDate(new Date($(this).find("h2").text())),
              events: [],
            };

            $(this)
              .find("li")
              .each(function () {
                // For each assignment...
                const title = $(this).find("h3").text();
                newGroup.events.push({
                  title,
                  type: getEventType(title),
                  course: $(this).find(".d2l-le-calendar-dot-name").text(),
                  time: $($(this).find(".d2l-textblock")[0]).text(),
                });
              });

            eventGroups.push(newGroup);
          });

        sendResponse(eventGroups);
      })
      .fail(() => sendResponse(null));
  });

  // This keeps the message channel open until we call sendResponse
  return true;
});