# Contact form setup (Google Apps Script + Google Sheet)

Both portfolio contact forms send enquiries to one Google Apps Script web app. For each enquiry it:

1. adds a row to the **Leads** tab of your Google Sheet
2. sends the visitor an automatic reply (different wording for the VA and developer sites)
3. emails you a notification at geraldjohnt@gmail.com (hit **Reply** to answer the visitor)

Until the web app link is added to the sites, the forms open a pre-filled email instead, so no enquiry is lost.

## One-time setup (about 10 minutes)

1. Go to https://sheets.google.com signed in as **geraldjohnt@gmail.com** and create a blank spreadsheet. Name it **Portfolio Leads**.
2. In the spreadsheet, click **Extensions → Apps Script**.
3. Delete everything in the editor, paste the full contents of `Code.gs`, and click **Save** (disk icon). Name the project **Portfolio Contact Form**.
4. Grant permissions and test:
   - In the function dropdown at the top, choose **testSetup**, then click **Run**.
   - Click **Review permissions**, choose your account, then **Advanced → Go to Portfolio Contact Form (unsafe) → Allow**.
     (Google shows this warning for every personal script; it is your own code.)
   - Check: a **Leads** tab with 2 test rows, and 4 emails in your inbox (2 automatic replies, 2 lead notifications).
5. Publish it:
   - Click **Deploy → New deployment**, then the gear icon → **Web app**.
   - Description: `Contact form v1`
   - Execute as: **Me (geraldjohnt@gmail.com)**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (starts with `https://script.google.com/macros/s/` and ends with `/exec`).
6. Send the Web app URL to Claude (or paste it yourself into `data-endpoint=""` on the `<form id="contact-form">` line in each site's `index.html`).
7. After the sites update, send one test message from each site's form.

## Changing the script later

Edit the code, click **Save**, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**.
This keeps the same URL, so the sites don't need changing.

## Good to know

- A personal Gmail account can send about 100 emails a day from scripts. Each enquiry uses 2 (auto-reply + notification).
  If the limit is reached, the enquiry is still saved and you're still notified; only the auto-reply is skipped.
- If the same email address sends again on the same site within 10 minutes, the message is still saved to the Sheet but no emails go out (stops double-clicks and email floods). Each site has its own 10-minute window.
- Bots that fill the hidden "website" field are silently ignored.
- To change the reply wording, edit `sendAutoReply_` in `Code.gs`. To change the reply time ("24 hours"), edit `REPLY_WITHIN` at the top.
