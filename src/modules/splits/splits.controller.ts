import { Body, Controller, Post } from '@nestjs/common';
import { PreviewSplitDto } from './dto/preview-split.dto';
import { SplitsService } from './splits.service';

@Controller('splits')
export class SplitsController {
  constructor(
    private readonly splitsService: SplitsService,
  ) {}

  @Post('preview')
  preview(@Body() dto: PreviewSplitDto) {
    return this.splitsService.preview(dto);
  }

  @Post('execute')
  execute(@Body() dto: PreviewSplitDto) {
    return this.splitsService.execute(dto);
  }
}