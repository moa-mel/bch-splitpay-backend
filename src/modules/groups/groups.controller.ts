import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateContributionDto } from './dto/create-contribution.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  create(@Body() dto: CreateGroupDto) {
    return this.groupsService.create(dto);
  }

  @Get()
  list() {
    return this.groupsService.list();
  }

  @Post(':groupId/contributions')
  contribute(@Param('groupId') groupId: string, @Body() dto: CreateContributionDto) {
    return this.groupsService.addContribution(groupId, dto);
  }
}
