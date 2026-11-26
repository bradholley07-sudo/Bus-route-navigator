const { chromium } = require("playwright");
const path = require("path");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    const makeLayer = () => ({ addTo(){return this}, on(){return this}, bindPopup(html){this.popup=html;return this} });
    window.L = {
      map(){return {remove(){}, invalidateSize(){}, fitBounds(){}, setView(){}}},
      tileLayer(){return makeLayer()},
      polyline(){return makeLayer()},
      marker(){return makeLayer()},
      latLngBounds(points){return points},
    };
    Object.defineProperty(navigator, "geolocation", {configurable:true,value:{
      getCurrentPosition(){},
      watchPosition(){return 1},
      clearWatch(){},
    }});
    localStorage.setItem("busList", JSON.stringify([{id:101,number:"101"}]));
    localStorage.setItem("busRoutes", JSON.stringify([{
      id:501,name:"Test Morning",mode:"Morning",busId:101,busNumber:"101",
      stops:[
        {number:1,name:"Oak Street",type:"Student Pickup",latitude:33.5,longitude:-86.8,accuracy:5},
        {number:2,name:"School",type:"School",latitude:33.51,longitude:-86.81,accuracy:5}
      ]
    }]));
  });
  await page.goto("file://" + path.resolve("index.html"));
  await page.getByRole("button", {name:/Route Map \/ Edit Stops/}).click();
  await page.locator("#regularRouteChoice").selectOption("501");
  await page.getByRole("button", {name:/Preview Selected Route/}).click();
  if (!(await page.locator("#routePreviewStopList").innerText()).includes("Oak Street")) throw new Error("Regular preview stop list missing");
  if (await page.locator("#routePreviewMap").count() !== 1) throw new Error("Regular preview map missing");
  const popup = await page.evaluate(() => {
    const input = document.createElement("input"); input.id = "previewStopName"; input.value = "Oak Street Renamed"; document.body.appendChild(input);
    savePreviewStopName(0);
    return JSON.parse(localStorage.getItem("busRoutes"))[0].stops[0].name;
  });
  if (popup !== "Oak Street Renamed") throw new Error("Regular driver could not save stop name");
  await page.getByRole("button", {name:/Start This Route/}).click();
  if (!(await page.locator("#navigationPanel").isVisible())) throw new Error("Start Route did not open navigation");
  if (!(await page.locator("#nextStop").innerText()).includes("Oak Street Renamed")) throw new Error("Navigation did not load selected route");
  await page.evaluate(() => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); watchId = null; goHome(); });
  await page.getByRole("button", {name:/Start Route/}).click();
  await page.locator("#routeSelect").selectOption("501");
  await page.getByRole("button", {name:/Preview Route Map/}).click();
  if (!(await page.locator("#routePreviewStopList").innerText()).includes("Oak Street Renamed")) throw new Error("Substitute preview stop list missing");
  const substitutePopup = await page.evaluate(() => {
    const s = previewRoute.stops[0];
    return "<b>" + escapeHTML(s.name) + "</b>";
  });
  if (substitutePopup.includes("input")) throw new Error("Substitute preview unexpectedly exposes edit input");
  if (errors.length) throw new Error("Browser errors: " + errors.join("; "));
  console.log("PASS: regular preview, stop list, stop rename persistence, Start Route, and substitute read-only preview");
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
