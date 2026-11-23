import { ICR, submitNetlifyForm } from "./api.js";
import { showToast } from "./app.js";

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("membership-form");
  const alertBox = document.getElementById("join-alert");

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const orig = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Submitting Application...";
    alertBox.className = "alert";

    const payload = {
      fullName: form.fullName.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      institution: form.institution.value.trim(),
      academicLevel: form.academicLevel.value,
      discipline: form.discipline.value.trim(),
      interests: form.interests.value.trim(),
      motivation: form.motivation.value.trim(),
    };

    try {
      await submitNetlifyForm(form);
      const res = await ICR.submitApplication(payload);
      alertBox.innerHTML = `<strong>Application Received (${res.applicationId || "Confirmed"}):</strong> ${res.message} You can also <a href="/portal.html" style="text-decoration:underline; font-weight:700;">create your Member Portal account now</a> to submit abstracts and RSVP for clinics.`;
      alertBox.className = "alert alert-success show";
      showToast("Membership application submitted!", "success");
      form.reset();
    } catch (err) {
      alertBox.textContent = err.message || "Please complete all required fields and try again.";
      alertBox.className = "alert alert-error show";
      showToast(err.message || "Submission error.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = orig;
    }
  });
});
