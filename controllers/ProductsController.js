const Product = require('../models/product');
const puppeteer = require('puppeteer');


const sleep = async time => new Promise(resolve => setTimeout(resolve, time * 1000));

exports.index = async (req, res) => {
  const products = await Product.find();
  res.render('products/index', {
    pageTitle: 'Products',
    products
  })
};

exports.update = async (req, res) => {
  const url = 'https://www.walmart.ca/en/electronics/tv-video/tvs/N-1170';
  const products = await scrapeIt(url);

  console.log(products);
  
  for (let product of products) {
    if (product.title === "" || product.price === "") continue;
    await Product.updateOne({sku: product.sku}, product, {upsert: true});
  }

  res.redirect('/products');
};

async function scrapeIt (url) {
  // Create a new browser instance
  const browser = await puppeteer.launch({headless: false});

  // Close the location request
  const context = browser.defaultBrowserContext();
  await context.overridePermissions(url, ['geolocation']);

  //Create page context
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 1080
  });

  // Close any prompts/alerts/confirms
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });

  //Exposing the console
  page.on('console', msg => console.log(msg._text));

  //Passing sleep function
  await page.exposeFunction('sleep', sleep);

  //Navigating to the URL
  await page.goto(url);
  sleep(5);
  // await page.screenshot({path: 'screenshots/example.png'});

  await page.evaluate(async () => {
    window.scrollBy(0, document.body.scrollHeight);
    await sleep(2);
  });
  
  await page.waitForSelector(`[class^="shelf-thumbs"]`, {visible: true, timeout: 120});

  const content = await page.evaluate(async () => {
    const productScrape = document.querySelectorAll('.standard-thumb');
    const products = [];

    for (let product of productScrape) {

      //Getting the SKU
      const link = product.querySelector('a').href;
      const parts = link.split('/');
      const sku = parts[parts.length - 1];

      const title = product.querySelector(`[class^="thumb-header"]`).textContent;
      const price = product.querySelector('.price-current').textContent.replace(/[^0-9.]/g,'');
      let image = product.querySelector('.image').dataset.original;
      image = `https:${image}`;

      products.push({sku, title, price, image});
    }

    return products;
  });

  await browser.close();
  return content;
}