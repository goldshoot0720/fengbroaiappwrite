from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:3000")
    page.get_by_role("button", name="Subscription").click()
    page.screenshot(path="jules-scratch/verification/subscription_page.png")
    browser.close()