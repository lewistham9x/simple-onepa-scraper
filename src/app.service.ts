import { flatten, Injectable } from '@nestjs/common';
import axios from 'axios';
import * as dayjs from 'dayjs';
@Injectable()
export class AppService {
  async getFacilities(
    outlet = 'Clementi',
    time = 'evening',
    page = 1,
  ): Promise<any> {
    const response = await axios.get(
      `https://www.onepa.gov.sg/pacesapi/facilitysearch/searchjson?facility=BADMINTON%20COURTS&outlet=${outlet}&date=&time=${time}&page=${page}&division=`,
    );

    return response.data.data.results;
  }

  padTo2Digits(num) {
    return num.toString().padStart(2, '0');
  }

  formatDate(date) {
    return [
      this.padTo2Digits(date.getDate()),
      this.padTo2Digits(date.getMonth() + 1),
      date.getFullYear(),
    ].join('/');
  }

  async getAvailability(
    facilityId: string,
    selectedDate: string,
  ): Promise<any> {
    const response = await axios.get(
      `https://www.onepa.gov.sg/pacesapi/facilityavailability/GetFacilitySlots?selectedFacility=${facilityId}&selectedDate=${selectedDate}`,
    );

    let resourceList = response.data.response.resourceList;
    resourceList = resourceList.map((resource) => {
      return {
        ...resource,
        facilityId,
      };
    });
    return resourceList;
  }

  async searchForFacility(
    outlet = 'boonlay',
    time = 'evening',
    days = 14,
  ): Promise<any> {
    const facilities = await this.getFacilities(outlet, time);

    const availabilityPromises = [];

    const today = new Date();

    const toDate = new Date().setDate(new Date().getDate() + days);

    for (let d = today; d <= new Date(toDate); d.setDate(d.getDate() + 1)) {
      availabilityPromises.push(
        ...facilities.map((facility) =>
          this.getAvailability(facility.name, this.formatDate(d)),
        ),
      );
    }

    const availability = await Promise.all(availabilityPromises);

    const availableFacilities = availability.map((response) => {
      const resourceList = response.map((resource) => {
        const slotList = resource.slotList;

        const availableSlots = slotList.filter(
          (slot) => slot.availabilityStatus !== 'Booked', // &&
          // slot.startTime.split('T')[1].replace(':', '') > '1800',
        );

        const availableSlotsWithFacilityInfo = availableSlots.map((slot) => ({
          ...slot,
          facilityId: resource.facilityId,
          courtName: resource.resourceName,
        }));

        return availableSlotsWithFacilityInfo;
      });

      return resourceList;
    });

    let flattened = [].concat(...availableFacilities);
    flattened = [].concat(...flattened);

    flattened.sort(function (a, b) {
      return ('' + b.startTime.split('T')[1]).localeCompare(
        a.startTime.split('T')[1],
      );
    });

    return flattened;
  }
}
