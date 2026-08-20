const $ = selector => document.querySelector(selector);

const money = number =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(number || 0);

const dateInput = (date = new Date()) => date.toISOString().slice(0, 10);

const readableDate = date =>
  new Date(date + "T12:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

const uuid = () =>
  crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

let data = JSON.parse(localStorage.getItem("moni-finanzas")) || {
  goals: [
    {
      id: "prepa",
      name: "Prepa en línea",
      target: 2000,
      saved: 0,
      deadline: dateInput(
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      ),
      color: "#a855f7"
    }
  ],
  payments: [
    {
      id: "mensualidad",
      name: "Pago de prepa",
      amount: 2000,
      date: dateInput(
        new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      ),
      monthly: true,
      color: "#a855f7"
    }
  ],
  movements: []
};

let currentCalendar = new Date();
currentCalendar.setDate(1);

let selectedDate = dateInput();

function save() {
  localStorage.setItem("moni-finanzas", JSON.stringify(data));
  render();
}

function weeksToDeadline(goal) {
  return Math.max(
    1,
    Math.ceil((new Date(goal.deadline + "T12") - new Date()) / 604800000)
  );
}

function paymentOccurs(payment, date) {
  const selected = new Date(date + "T12");
  const original = new Date(payment.date + "T12");

  if (payment.monthly) {
    return (
      selected.getDate() === original.getDate() &&
      selected >= original
    );
  }

  return date === payment.date;
}

function paymentsForDate(date) {
  return data.payments.filter(payment => paymentOccurs(payment, date));
}

function nextPayment() {
  const date = new Date();

  for (let i = 0; i < 370; i++) {
    const currentDate = dateInput(date);
    const payments = paymentsForDate(currentDate);

    if (payments.length) {
      return {
        date: currentDate,
        payment: payments[0]
      };
    }

    date.setDate(date.getDate() + 1);
  }
}

function render() {
  const income = data.movements
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const expenses = data.movements
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const pending = data.goals.reduce(
    (sum, goal) => sum + Math.max(0, goal.target - goal.saved),
    0
  );

  const upcoming = nextPayment();

  $("#availableAmount").textContent = money(income - expenses);
  $("#pendingAmount").textContent = money(pending);

  $("#nextPaymentAmount").textContent = upcoming
    ? money(upcoming.payment.amount)
    : "—";

  $("#nextPaymentName").textContent = upcoming
    ? `${upcoming.payment.name} · ${readableDate(upcoming.date)}`
    : "Sin pagos pendientes";

  $("#weeklyPlan").innerHTML = data.goals.length
    ? data.goals
        .map(
          goal => `
          <div class="item">
            <span>
              <b>${goal.name}</b>
              <small>Fecha meta: ${readableDate(goal.deadline)}</small>
            </span>
            <b class="plus">
              ${money(
                Math.ceil(
                  Math.max(0, goal.target - goal.saved) /
                    weeksToDeadline(goal)
                )
              )}/semana
            </b>
          </div>
        `
        )
        .join("")
    : `<p class="muted">Crea una meta para tener un plan semanal.</p>`;

  $("#nextPaymentCard").innerHTML = upcoming
    ? `
      <small>${readableDate(upcoming.date).toUpperCase()}</small>
      <strong>${upcoming.payment.name}</strong>
      <b>${money(upcoming.payment.amount)}</b>
    `
    : "Aún no agregas pagos.";

  $("#goalsList").innerHTML = data.goals.length
    ? data.goals
        .map(goal => {
          const progress = Math.min(
            100,
            Math.round((goal.saved / goal.target) * 100)
          );

          return `
            <article class="glass-card goal" style="--color:${goal.color}">
              <span class="label">META</span>
              <h3>${goal.name}</h3>
              <p>${money(goal.saved)} de ${money(goal.target)} · ${progress}%</p>
              <div class="progress">
                <i style="width:${progress}%"></i>
              </div>
              <div class="goal-footer">
                <span>
                  ${money(
                    Math.ceil(
                      Math.max(0, goal.target - goal.saved) /
                        weeksToDeadline(goal)
                    )
                  )}/semana
                </span>
                <span>${readableDate(goal.deadline)}</span>
              </div>
            </article>
          `;
        })
        .join("")
    : `<p class="muted">Todavía no hay metas.</p>`;

  $("#totals").innerHTML = `
    <div class="total">
      <span>Ingresos</span>
      <b class="plus">${money(income)}</b>
    </div>
    <div class="total">
      <span>Gastos</span>
      <b class="minus">-${money(expenses)}</b>
    </div>
  `;

  $("#movementList").innerHTML = data.movements.length
    ? [...data.movements]
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(
          movement => `
          <div class="item">
            <span>
              <b>${movement.description}</b>
              <small>
                ${readableDate(movement.date)}
                ${movement.goal ? " · " + movement.goal : ""}
              </small>
            </span>
            <b class="${movement.type === "expense" ? "minus" : "plus"}">
              ${movement.type === "expense" ? "-" : "+"}${money(movement.amount)}
            </b>
          </div>
        `
        )
        .join("")
    : `<p class="muted">Aquí aparecerán tus ingresos, gastos y ahorros.</p>`;

  $("#goalSelect").innerHTML =
    `<option value="">No aplica</option>` +
    data.goals
      .map(goal => `<option value="${goal.id}">${goal.name}</option>`)
      .join("");

  renderCalendar();
  renderSelectedDay();
}

function renderCalendar() {
  const year = currentCalendar.getFullYear();
  const month = currentCalendar.getMonth();

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDay = (firstDay.getDay() + 6) % 7;

  $("#calendarTitle").textContent = firstDay.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric"
  });

  let html = "";

  for (let i = 0; i < startDay; i++) {
    html += "<div></div>";
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = dateInput(new Date(year, month, day));
    const payments = paymentsForDate(currentDate);

    html += `
      <button
        class="day ${currentDate === dateInput() ? "today" : ""}
        ${currentDate === selectedDate ? "selected" : ""}"
        data-date="${currentDate}"
      >
        ${day}

        ${
          payments.length
            ? `
            <span class="dots">
              ${payments
                .slice(0, 3)
                .map(
                  payment => `
                    <i
                      class="dot"
                      style="background:${payment.color}; color:${payment.color}"
                    ></i>
                  `
                )
                .join("")}
            </span>
          `
            : ""
        }
      </button>
    `;
  }

  $("#calendarDays").innerHTML = html;

  document.querySelectorAll(".day").forEach(button => {
    button.onclick = () => {
      selectedDate = button.dataset.date;
      renderCalendar();
      renderSelectedDay();
    };
  });
}

function renderSelectedDay() {
  const payments = paymentsForDate(selectedDate);

  $("#selectedDateLabel").textContent =
    readableDate(selectedDate).toUpperCase();

  $("#selectedDayTitle").textContent = payments.length
    ? `Pagos del día (${payments.length})`
    : "No tienes pagos este día";

  $("#selectedDayPayments").innerHTML = payments.length
    ? payments
        .map(
          payment => `
          <div class="payment-detail" style="--color:${payment.color}">
            <b>${payment.name}</b>
            <span>
              ${money(payment.amount)}
              ${payment.monthly ? " · Cada mes" : ""}
            </span>
          </div>
        `
        )
        .join("")
    : "Puedes agregar un pago usando el botón de arriba.";
}

document.querySelectorAll(".nav-button").forEach(button => {
  button.onclick = () => {
    document.querySelectorAll(".nav-button, .page").forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");
    $("#" + button.dataset.section).classList.add("active");
  };
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.onclick = () => {
    document
      .querySelector(`[data-section="${button.dataset.go}"]`)
      .click();
  };
});

function openDialog(id) {
  $(id).showModal();
}

$("#addGoalButton").onclick = () => openDialog("#goalDialog");
$("#addPaymentButton").onclick = () => openDialog("#paymentDialog");
$("#addMovementButton").onclick = () => openDialog("#movementDialog");
$("#addMovementButton2").onclick = () => openDialog("#movementDialog");

document.querySelectorAll(".close").forEach(button => {
  button.onclick = () => button.closest("dialog").close();
});

$("#previousMonth").onclick = () => {
  currentCalendar.setMonth(currentCalendar.getMonth() - 1);
  renderCalendar();
};

$("#nextMonth").onclick = () => {
  currentCalendar.setMonth(currentCalendar.getMonth() + 1);
  renderCalendar();
};

$("#goalForm").onsubmit = event => {
  event.preventDefault();

  const form = Object.fromEntries(new FormData(event.target));

  data.goals.push({
    id: uuid(),
    name: form.name,
    target: Number(form.target),
    saved: Number(form.saved),
    deadline: form.deadline,
    color: form.color
  });

  event.target.closest("dialog").close();
  event.target.reset();
  save();
};

$("#paymentForm").onsubmit = event => {
  event.preventDefault();

  const form = Object.fromEntries(new FormData(event.target));

  data.payments.push({
    id: uuid(),
    name: form.name,
    amount: Number(form.amount),
    date: form.date,
    monthly: Boolean(form.monthly),
    color: form.color
  });

  selectedDate = form.date;
  currentCalendar = new Date(form.date + "T12:00:00");
  currentCalendar.setDate(1);

  event.target.closest("dialog").close();
  event.target.reset();
  save();
};

$("#movementForm").onsubmit = event => {
  event.preventDefault();

  const form = Object.fromEntries(new FormData(event.target));
  const goal = data.goals.find(item => item.id === form.goalId);

  if (form.type === "saving" && goal) {
    goal.saved += Number(form.amount);
  }

  data.movements.push({
    id: uuid(),
    type: form.type,
    description: form.description,
    amount: Number(form.amount),
    date: form.date,
    goal: goal ? goal.name : ""
  });

  event.target.closest("dialog").close();
  event.target.reset();
  save();
};

$("#notificationButton").onclick = async () => {
  if (!("Notification" in window)) {
    alert("Las notificaciones estarán disponibles al convertir la app en APK.");
    return;
  }

  const response = await Notification.requestPermission();

  alert(
    response === "granted"
      ? "Recordatorios activados."
      : "No diste permiso para las notificaciones."
  );
};

document.querySelectorAll('input[type="date"]').forEach(input => {
  input.value = dateInput();
});

render();
