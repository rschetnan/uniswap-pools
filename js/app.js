async function getPairs()
{
  try {
      let res = await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query: "{ pairs(first: 400, orderBy: reserveUSD, orderDirection: desc) { id token0 { symbol } token1 { symbol } } }"})
      })
      return await res.json();
  } catch (error) {
      console.log(error);
  }
}

async function renderPairs()
{
  let pairs = await getPairs();

  let htmlMarkup = '';

  let pairSelectControl = document.getElementById("pairSelectControl");

  for(var i = 0; i < pairs["data"]["pairs"].length; i++)
  {
    let pairOption = document.createElement("option");
    pairOption.text = `${pairs["data"]["pairs"][i]["token0"]["symbol"]} - ${pairs["data"]["pairs"][i]["token1"]["symbol"]}`;
    pairOption.value = pairs["data"]["pairs"][i]["id"];
    pairSelectControl.appendChild(pairOption);
  }

  pairSelectControl.selectedIndex = 0;

  document.getElementById("loader").style.display = "none";

  document.getElementById("showDataButton").disabled = false;

  document.getElementById("pairSelectControl").disabled = false;

}

async function getPairPerformanceData() {
  let selectedPairIndex = document.getElementById("pairSelectControl").selectedIndex;
  let selectedPairValue = document.getElementsByTagName("option")[selectedPairIndex].value

  let currentMillis = Date.now();
  let millisInDay = 24 * 60 * 60 * 1000;
  let millisDifference = millisInDay * 61;
  let startMillis = currentMillis - millisDifference;
  let startSeconds = Math.round(startMillis / 1000)

  let queryContent = `{ pairDayDatas( first: 60, orderBy: date, orderDirection: asc, where: { pairAddress: \"${selectedPairValue}\", date_gt: ${startSeconds} } ) { date dailyVolumeUSD reserveUSD } }`

  let queryObject = { query: queryContent };

  try {
      let res = await fetch('https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(queryObject)
      })
      return await res.json();
  } catch (error) {
      console.log(error);
  }
}

async function renderPairPerformanceData()
{
  document.getElementById("showDataButton").disabled = true;

  document.getElementById("pairSelectControl").disabled = true;

  document.getElementById("loader").style.display = "block";

  let performanceData = await getPairPerformanceData();

  let pairDataArray = [['Date', 'Volume', 'Liquidity', 'Fees']];

  let performanceDataLength = performanceData["data"]["pairDayDatas"].length;

  let liquiditySum = 0;

  let volumeSum = 0;

  let feeSum = 0;

  for (var i = 0; i < performanceDataLength; i++)
  {

    let dateSeconds = performanceData["data"]["pairDayDatas"][i]["date"];

    let dateMillis = dateSeconds * 1000;

    let pairDate = new Date();

    pairDate.setTime(dateMillis);

    let pairMonth = pairDate.getUTCMonth() + 1;

    let formattedPairDate = `${pairMonth}-${pairDate.getUTCDate()}-${pairDate.getUTCFullYear()}`;

    let roundedVolume = Math.round(performanceData["data"]["pairDayDatas"][i]["dailyVolumeUSD"]);

    volumeSum += roundedVolume;

    let fees = roundedVolume * 0.003;

    let roundedFees = Math.round(fees);

    feeSum += roundedFees;

    let roundedLiquidity = Math.round(performanceData["data"]["pairDayDatas"][i]["reserveUSD"]);

    liquiditySum += roundedLiquidity

    let dailyPerformanceData = [ formattedPairDate, roundedVolume, roundedLiquidity, roundedFees ];

    pairDataArray.push(dailyPerformanceData);

  }

  let averageVolume = 0;

  let averageFees = 0;

  let averageLiquidity = 0;

  let feesToLiquidity = 0;

  if (liquiditySum > 0) {
    feesToLiquidity = feeSum / liquiditySum;
  }

  let averageDailyFees = feesToLiquidity * 1000;

  //Avoid division by zero
  if (performanceDataLength > 0)
  {

    averageVolume = volumeSum / performanceDataLength;

    averageFees = feeSum / performanceDataLength;

    averageLiquidity = liquiditySum / performanceDataLength;

  }

  let statsDiv = document.getElementById("stats");

  let childElement = statsDiv.firstElementChild;

  while (childElement) {
    childElement.remove();

    childElement = statsDiv.firstElementChild;
  }

  let headingElement =  document.createElement("h4");

  headingElement.appendChild(document.createTextNode("60-Day Averages in USD"));

  statsDiv.appendChild(headingElement);

  let formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageLiquidity);

  let textNodeContent = `Average liquidity: ${formattedNumber}`;

  let textNode = document.createTextNode(textNodeContent);

  let paragraphElement = document.createElement("p");

  paragraphElement.appendChild(textNode);

  statsDiv.appendChild(paragraphElement);

  formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageVolume);

  textNodeContent = `Average volume: ${formattedNumber}`;

  textNode = document.createTextNode(textNodeContent);

  paragraphElement = document.createElement("p");

  paragraphElement.appendChild(textNode);

  statsDiv.appendChild(paragraphElement);

  formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageFees);

  textNodeContent = `Average fees: ${formattedNumber}`;

  textNode = document.createTextNode(textNodeContent);

  paragraphElement = document.createElement("p");

  paragraphElement.appendChild(textNode);

  statsDiv.appendChild(paragraphElement);

  textNodeContent = `Fees to liquidity ratio: ${feesToLiquidity}`;

  textNode = document.createTextNode(textNodeContent);

  paragraphElement = document.createElement("p");

  paragraphElement.appendChild(textNode);

  statsDiv.appendChild(paragraphElement);

  formattedNumber = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(averageDailyFees);

  textNodeContent = `Average daily fees earned on $1,000 liquidity (ignoring accrual and impermanent loss): ${formattedNumber}`;

  textNode = document.createTextNode(textNodeContent);

  paragraphElement = document.createElement("p");

  paragraphElement.appendChild(textNode);

  statsDiv.appendChild(paragraphElement);

  let chartData = google.visualization.arrayToDataTable(pairDataArray);

  let selectedPairIndex = document.getElementById("pairSelectControl").selectedIndex;

  let selectedPairText = document.getElementsByTagName("option")[selectedPairIndex].text;

  let titleText = `${selectedPairText} Liquidity Pool Performance`;

  let options = {
        title: titleText,
        hAxis: {title: 'Date',  titleTextStyle: {color: '#333'}},
        vAxis: {minValue: 0}
      };

  document.getElementById("loader").style.display = "none";

  document.getElementById("banner").style.display = "none";

  document.getElementById("chart").style.display = "block";

  document.getElementById("showDataButton").disabled = false;

  document.getElementById("pairSelectControl").disabled = false;

  let chart = new google.visualization.AreaChart(document.getElementById('chart'));

  chart.draw(chartData, options);

}

$(document).ready(function() {

    $('.selectClass').select2();

    document.getElementById("showDataButton").addEventListener("click", renderPairPerformanceData);

    google.charts.load('current', {'packages':['corechart']});

    renderPairs();

});
