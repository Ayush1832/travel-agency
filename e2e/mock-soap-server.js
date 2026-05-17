/**
 * Mock TBO SOAP server for E2E tests.
 * Listens on port 5099, parses SOAPAction header, returns deterministic XML responses.
 *
 * Operations handled:
 *   HotelSearch   → 1 hotel (HTL-E2E-001) with 1 room (ROOM-TKN-E2E-001)
 *   HotelDetails  → Hotel details for HTL-E2E-001
 *   PreBook       → Success with AuthenticationKey = PREBOOK-AUTH-E2E-001
 *   Book          → Confirmed booking BookingId = TBO-BK-E2E-001
 *   Cancel        → Cancelled with RefundAmount = 10000 (100 AED in fils)
 */

const http = require('http');

const HOTEL_CODE = 'HTL-E2E-001';
const ROOM_TOKEN = 'ROOM-TKN-E2E-001';
const PREBOOK_AUTH = 'PREBOOK-AUTH-E2E-001';
const TBO_BOOKING_ID = 'TBO-BK-E2E-001';

function soapEnvelope(action, body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action}Response>
      ${body}
    </${action}Response>
  </soap:Body>
</soap:Envelope>`;
}

function hotelSearchResponse() {
  return soapEnvelope('HotelSearch', `
    <HotelSearchResult>
      <HotelResults>
        <HotelCode>${HOTEL_CODE}</HotelCode>
        <HotelName>Grand Mock Hotel E2E</HotelName>
        <HotelCategory>5 Star</HotelCategory>
        <StarRating>5</StarRating>
        <HotelAddress>123 Sheikh Zayed Road, Dubai</HotelAddress>
        <HotelContactNo>+971-4-000-0000</HotelContactNo>
        <HotelMap>25.2048|55.2708</HotelMap>
        <HotelPicture>https://example.com/hotel.jpg</HotelPicture>
        <HotelDescription>Luxury mock hotel for E2E testing</HotelDescription>
        <ResultToken>SRCH-E2E-TOKEN-001</ResultToken>
        <Rooms>
          <BookingCode>${ROOM_TOKEN}</BookingCode>
          <RoomTypeName>Deluxe Room</RoomTypeName>
          <MealType>Breakfast Included</MealType>
          <Refundable>true</Refundable>
          <RoomAdultCount>2</RoomAdultCount>
          <RoomChildCount>0</RoomChildCount>
          <CancellationPolicies/>
        </Rooms>
        <Price>
          <OfferedPrice>100</OfferedPrice>
          <PublishedPrice>120</PublishedPrice>
          <ServiceTax>5</ServiceTax>
          <Currency>AED</Currency>
        </Price>
      </HotelResults>
    </HotelSearchResult>`);
}

function hotelDetailsResponse() {
  return soapEnvelope('HotelDetails', `
    <Hotels>
      <Hotel>
        <HotelCode>${HOTEL_CODE}</HotelCode>
        <HotelName>Grand Mock Hotel E2E</HotelName>
        <HotelCategory>5 Star</HotelCategory>
        <StarRating>5</StarRating>
        <HotelAddress>123 Sheikh Zayed Road, Dubai</HotelAddress>
        <HotelContactNo>+971-4-000-0000</HotelContactNo>
        <HotelMap>25.2048|55.2708</HotelMap>
        <HotelPicture>https://example.com/hotel.jpg</HotelPicture>
        <HotelDescription>Luxury mock hotel for E2E testing</HotelDescription>
        <CityName>Dubai</CityName>
        <CountryName>UAE</CountryName>
        <HotelFacilities>WiFi</HotelFacilities>
        <HotelFacilities>Pool</HotelFacilities>
        <HotelFacilities>Restaurant</HotelFacilities>
        <Images>https://example.com/hotel-1.jpg</Images>
        <Images>https://example.com/hotel-2.jpg</Images>
      </Hotel>
    </Hotels>`);
}

function prebookResponse() {
  return soapEnvelope('PreBook', `
    <Status>
      <StatusId>1</StatusId>
      <Description>Success</Description>
    </Status>
    <AvailabilityType>Available</AvailabilityType>
    <AuthenticationKey>${PREBOOK_AUTH}</AuthenticationKey>
    <HotelResult>
      <HotelCode>${HOTEL_CODE}</HotelCode>
      <HotelName>Grand Mock Hotel E2E</HotelName>
      <HotelAddress>123 Sheikh Zayed Road, Dubai</HotelAddress>
      <HotelPicture>https://example.com/hotel.jpg</HotelPicture>
      <HotelMap>25.2048|55.2708</HotelMap>
      <Price>
        <OfferedPrice>100</OfferedPrice>
        <ServiceTax>5</ServiceTax>
        <Currency>AED</Currency>
      </Price>
      <Rooms>
        <RoomTypeName>Deluxe Room</RoomTypeName>
        <MealType>Breakfast Included</MealType>
        <Refundable>true</Refundable>
        <TotalFare>100</TotalFare>
        <CancellationPolicies/>
      </Rooms>
    </HotelResult>`);
}

function bookResponse() {
  return soapEnvelope('Book', `
    <BookingId>${TBO_BOOKING_ID}</BookingId>
    <ConfirmationNo>CONF-E2E-001</ConfirmationNo>
    <BookingStatus>Confirmed</BookingStatus>
    <Status>
      <StatusId>1</StatusId>
      <Description>Booking Confirmed</Description>
    </Status>
    <HotelBookingDetail>
      <HotelCode>${HOTEL_CODE}</HotelCode>
      <HotelName>Grand Mock Hotel E2E</HotelName>
      <HotelAddress>123 Sheikh Zayed Road, Dubai</HotelAddress>
      <CityName>Dubai</CityName>
      <CountryName>UAE</CountryName>
      <StarRating>5</StarRating>
      <HotelContactNo>+971-4-000-0000</HotelContactNo>
      <HotelPicture>https://example.com/hotel.jpg</HotelPicture>
      <HotelMap>25.2048|55.2708</HotelMap>
      <Rooms>
        <RoomTypeName>Deluxe Room</RoomTypeName>
        <MealType>Breakfast Included</MealType>
        <CancellationPolicies/>
      </Rooms>
    </HotelBookingDetail>`);
}

function cancelResponse() {
  return soapEnvelope('Cancel', `
    <IsCancelled>true</IsCancelled>
    <RefundAmount>0</RefundAmount>
    <CancellationCharge>0</CancellationCharge>
    <Status>
      <StatusId>1</StatusId>
      <Description>Cancellation Successful</Description>
    </Status>`);
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const soapAction = (req.headers['soapaction'] || '').replace(/"/g, '');
    let xml = '';

    if (soapAction.includes('HotelSearch') || body.includes('HotelSearchRQ')) {
      xml = hotelSearchResponse();
    } else if (soapAction.includes('HotelDetails') || body.includes('HotelDetailsRQ')) {
      xml = hotelDetailsResponse();
    } else if (soapAction.includes('PreBook') || body.includes('PreBookRQ')) {
      xml = prebookResponse();
    } else if (soapAction.includes('Book') || body.includes('BookRQ')) {
      xml = bookResponse();
    } else if (soapAction.includes('Cancel') || body.includes('CancelRQ')) {
      xml = cancelResponse();
    } else {
      res.writeHead(400, { 'Content-Type': 'text/xml' });
      res.end(`<error>Unknown SOAP action: ${soapAction}</error>`);
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/xml; charset=utf-8' });
    res.end(xml);
  });
});

const PORT = process.env.MOCK_SOAP_PORT || 5099;
server.listen(PORT, () => {
  console.log(`[mock-soap] TBO mock server listening on port ${PORT}`);
});

// Allow graceful shutdown
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
