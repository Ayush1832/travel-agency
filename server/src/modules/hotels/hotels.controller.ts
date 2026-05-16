import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { HotelsService } from './hotels.service';
import { HotelSearchDto } from './dto/hotel-search.dto';
import { PrebookDto } from './dto/prebook.dto';

@UseGuards(JwtAuthGuard)
@Controller('hotels')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  /**
   * GET /api/v1/hotels/destinations/autocomplete?q=Dubai
   */
  @Get('destinations/autocomplete')
  getDestinationsAutocomplete(@Query('q') q: string) {
    return this.hotelsService.getDestinationsAutocomplete(q ?? '');
  }

  /**
   * POST /api/v1/hotels/search
   */
  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: HotelSearchDto) {
    return this.hotelsService.search(dto);
  }

  /**
   * GET /api/v1/hotels/:supplierHotelId?searchId=<hash>
   */
  @Get(':supplierHotelId')
  async getDetails(
    @Param('supplierHotelId') supplierHotelId: string,
    @Query('searchId') searchId: string,
  ) {
    return this.hotelsService.getDetails(supplierHotelId, searchId ?? '');
  }

  /**
   * POST /api/v1/hotels/prebook
   */
  @Post('prebook')
  @HttpCode(HttpStatus.OK)
  async prebook(@Body() dto: PrebookDto) {
    return this.hotelsService.prebook(dto.roomToken);
  }
}
