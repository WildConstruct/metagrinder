import {
  exportGraphToPSG,
  parsePSG,
  convertPSGToPSGLib
} from '../fileFormats/psg';

describe('PSG export round-trip', () => {
  test('exports a simple graph to canonical flat PSG', () => {
    const psg = exportGraphToPSG(
      [
        {
          id: 'text-1',
          type: 'textBlock',
          position: { x: 40, y: 80 },
          data: {
            label: 'Prefix',
            value: 'muppet styled'
          }
        },
        {
          id: 'choice-1',
          type: 'weightedChoice',
          position: { x: 360, y: 80 },
          data: {
            label: 'City Mood',
            options: [
              { id: 'a', text: 'new york cityscape', weight: 3 },
              { id: 'b', text: 'stressed out muppets', weight: 1 }
            ]
          }
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 680, y: 80 },
          data: {
            label: 'Output',
            value: '{prompt}'
          }
        }
      ],
      [
        {
          id: 'edge-1',
          source: 'text-1',
          target: 'choice-1',
          sourceHandle: 'source',
          targetHandle: 'target'
        },
        {
          id: 'edge-2',
          source: 'choice-1',
          target: 'output-1',
          sourceHandle: 'source'
        }
      ],
      {
        name: 'Weekend MVP Example',
        description: 'Controlled prompt variation example'
      }
    );

    expect(psg.name).toBe('Weekend MVP Example');
    expect(psg.version).toBe('1.0.0');
    expect(psg.nodes).toHaveLength(3);
    expect(psg.edges).toHaveLength(2);
    expect(psg.nodes.map(node => node.type)).toEqual([
      'TextBlock',
      'WeightedChoice',
      'Output'
    ]);
    expect(psg.nodes[0]).toMatchObject({
      id: 'text-1',
      type: 'TextBlock',
      value: 'muppet styled',
      x: 40,
      y: 80
    });
    expect(psg.nodes[1]).toMatchObject({
      id: 'choice-1',
      type: 'WeightedChoice',
      options: [
        { text: 'new york cityscape', weight: 3 },
        { text: 'stressed out muppets', weight: 1 }
      ]
    });
    expect(psg.edges[0]).toEqual({
      id: 'edge-1',
      source: 'text-1',
      target: 'choice-1'
    });
    expect(psg.edges[1]).toEqual({
      id: 'edge-2',
      source: 'choice-1',
      target: 'output-1'
    });
  });

  test('round-trips imported wrapper children back to semantic regions', () => {
    const psg = exportGraphToPSG(
      [
        {
          id: 'wrapper-1',
          type: 'enhancedBoundingBox',
          position: { x: 100, y: 40 },
          width: 500,
          height: 420,
          data: {
            title: 'Character Generator',
            description: 'Imported fragment wrapper',
            fragmentImported: true,
            fragmentRegions: [
              {
                id: 'region-primary',
                name: 'Primary',
                color: '#22d3ee',
                nodes: ['choice-1', 'concat-1']
              }
            ]
          }
        },
        {
          id: 'choice-1',
          type: 'weightedChoice',
          parentNode: 'wrapper-1',
          position: { x: 60, y: 100 },
          data: {
            label: 'Body Type',
            options: [
              { text: 'thin', weight: 2 },
              { text: 'stocky', weight: 1 }
            ],
            fragmentRegionIds: ['region-primary']
          }
        },
        {
          id: 'concat-1',
          type: 'concat',
          parentNode: 'wrapper-1',
          position: { x: 300, y: 120 },
          data: {
            label: 'Join'
          }
        },
        {
          id: 'output-1',
          type: 'output',
          position: { x: 760, y: 220 },
          data: {
            label: 'Output',
            value: '{prompt}'
          }
        }
      ],
      [
        {
          id: 'edge-1',
          source: 'choice-1',
          target: 'concat-1',
          sourceHandle: 'source',
          targetHandle: 'input1'
        },
        {
          id: 'edge-2',
          source: 'concat-1',
          target: 'output-1',
          sourceHandle: 'source'
        }
      ],
      {
        name: 'Imported Fragment'
      }
    );

    expect(psg.nodes).toHaveLength(3);
    expect(psg.nodes.find(node => node.id === 'wrapper-1')).toBeUndefined();
    expect(psg.regions).toEqual([
      {
        id: 'wrapper-1-region-primary',
        name: 'Primary',
        color: '#22d3ee',
        nodes: ['choice-1', 'concat-1']
      }
    ]);
    expect(psg.edges).toEqual([
      {
        id: 'edge-1',
        source: 'choice-1',
        target: 'concat-1',
        targetHandle: 'input1'
      },
      {
        id: 'edge-2',
        source: 'concat-1',
        target: 'output-1'
      }
    ]);

    const reparsed = parsePSG(JSON.stringify(psg));
    const converted = convertPSGToPSGLib(reparsed);
    expect(
      converted.graph.nodes.some(
        (node: { type: string }) => node.type === 'enhancedBoundingBox'
      )
    ).toBe(true);
  });
});
