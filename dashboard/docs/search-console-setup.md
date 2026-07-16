# Google Search Console setup

Search Console is how we prove StileAI owns stileai.com to Google, submit our sitemap, and then watch exactly which searches bring us traffic. It is free. This takes about 5 minutes and I have already wired up the code side so you only paste one value.

## What I already did

The site is ready to verify by the "HTML tag" method. There is a hidden slot in the site's code that reads a value called `GOOGLE_SITE_VERIFICATION`. Once you paste Google's code into Vercel (step 3 below), the verification tag renders itself. No code editing on your end.

## Your steps

**1. Open Search Console**
Go to https://search.google.com/search-console and sign in with the Google account you want to own this (your business Google account is best).

**2. Add the property**
- Click "Add property."
- Choose the **URL prefix** option (the right-hand box), not Domain.
- Enter `https://stileai.com` and click Continue.

**3. Get the verification code**
- Google shows several verification methods. Expand **"HTML tag."**
- It shows something like: `<meta name="google-site-verification" content="ABC123xyz..." />`
- Copy **only** the value inside `content="..."` (the `ABC123xyz...` part), not the whole tag.

**4. Paste it into Vercel**
- Go to your Vercel project, Settings, Environment Variables.
- Add a new variable:
  - Name: `GOOGLE_SITE_VERIFICATION`
  - Value: the code you copied
  - Environments: check Production (and Preview if you like)
- Save.

**5. Redeploy**
- Vercel needs one redeploy for the new variable to take effect. Either push any small change, or in Vercel go to Deployments and click "Redeploy" on the latest one.
- Wait for it to finish (usually 1-2 minutes).

**6. Verify**
- Back in Search Console, click **Verify**.
- It should say verified. If it says it cannot find the tag, wait 2 minutes for the deploy to finish and try again.

## After you are verified

**Submit the sitemap** (this tells Google about all our pages at once):
- In Search Console, left menu, click **Sitemaps**.
- Enter `sitemap.xml` and click Submit.
- That is it. Google will start crawling the keyword pages and blog posts.

## What to watch (come back in a few weeks)

- **Performance** tab: which search terms show us, how often we are clicked. This tells us which keywords are working so I can double down.
- **Pages / Indexing** tab: confirms Google has actually indexed our pages.

Tell me once you are verified and I will help read the first data and decide the next keyword pages to build.
