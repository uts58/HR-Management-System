import { BACKEND_TAG } from "../support/env";
import { expect, test, users } from "../support/fixtures";
import { seededJohnLeave } from "../support/users";

/**
 * ADR-0007: calendar dates (DOB, leave and project dates) are never
 * converted. The same text must appear for viewers in UTC+14 and UTC-11.
 */

const ZONES = ["Pacific/Kiritimati", "Pacific/Pago_Pago"] as const; // UTC+14, UTC-11
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const label = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
};

for (const timezoneId of ZONES) {
  test(`calendar dates render exactly as stored for a viewer in ${timezoneId}`, async ({
    as,
  }) => {
    const hr = await as(users.admin, { timezoneId });
    let checked = 0;
    for (const path of [
      "/leave/all",
      "/appraisals",
      `/employees/${users.john.employeeId}`,
    ]) {
      await hr.page.goto(path);
      await expect(hr.page.getByRole("heading", { level: 1 })).toBeVisible();
      const dates = hr.page.locator("main time[datetime]");
      for (const el of await dates.all()) {
        const iso = (await el.getAttribute("datetime")) ?? "";
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) continue; // instants are LocalTime, not calendar dates
        await expect(el, `${path} ${iso}`).toHaveText(label(iso));
        checked += 1;
      }
    }
    expect(
      checked,
      "no calendar dates found on the checked pages",
    ).toBeGreaterThan(0);
  });

  test(
    `a seeded leave shows the stored dates for a viewer in ${timezoneId}`,
    { tag: BACKEND_TAG },
    async ({ as }) => {
      const hr = await as(users.admin, { timezoneId });
      await hr.page.goto("/leave/all");
      await expect(hr.leave.row("Holidays")).toContainText(
        seededJohnLeave.label,
      );
      await hr.page.goto(`/employees/${users.john.employeeId}`);
      await expect(hr.employees.detail("Date of birth")).toHaveText(
        "1 Jan 1990",
      );
    },
  );
}
